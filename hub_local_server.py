#!/usr/bin/env python3
import base64, datetime as dt, json, os, re, shutil, sys, uuid, zipfile
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / 'static'
UPLOADS = ROOT / '.hub_uploads'
BACKUPS = ROOT / '.hub_backups'
STATE = ROOT / '.hub_source_state.json'
UPLOADS.mkdir(exist_ok=True)
BACKUPS.mkdir(exist_ok=True)

NS = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'pr': 'http://schemas.openxmlformats.org/package/2006/relationships'}


def norm(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii','ignore').decode().upper().strip()
    s = re.sub(r'\s+', ' ', s)
    return s

HEADER_MAP = {
    'COMPANIA':'COMPAÑÍA','IAFA':'COMPAÑÍA','ASEGURADORA':'COMPAÑÍA','FINANCIADOR':'COMPAÑÍA',
    'SUB CIA':'SUB CIA','SUBCIA':'SUB CIA','SUB COMPANIA':'SUB CIA','PRODUCTO':'SUB CIA','PLAN':'SUB CIA',
    'ID':'ID','CODIGO':'ID','CODIGO ID':'ID','COD':'ID',
    'LISTA':'LISTA','TIPO LISTA':'LISTA','LISTA AB':'LISTA',
    'TECNOLOGIA':'TECNOLOGÍA','PRESTACION':'TECNOLOGÍA','DESCRIPCION':'TECNOLOGÍA','SERVICIO':'TECNOLOGÍA','PROCEDIMIENTO':'TECNOLOGÍA',
    'SERVICIO O PROCEDIMIENTO':'SERVICIO O PROCEDIMIENTO',
    'COBERTURA':'COBERTURA','ESTADO COBERTURA':'COBERTURA',
    'CONDICIONES':'CONDICIONES','CONDICION':'CONDICIONES',
    'EXCEPCIONES':'EXCEPCIONES','EXCEPCION':'EXCEPCIONES',
    'DETALLES':'DETALLES','DETALLE':'DETALLES','OBSERVACIONES':'DETALLES','OBSERVACION':'DETALLES',
    'PALABRAS CLAVE':'PALABRAS CLAVE','KEYWORDS':'PALABRAS CLAVE',
    'REQUIERE CG':'REQUIERE CG','CARTA DE GARANTIA':'REQUIERE CG','REQUIERE CARTA DE GARANTIA':'REQUIERE CG',
    'CONDICIONES / EXCEPCIONES':'CONDICIONES / EXCEPCIONES','CONDICIONES/EXCEPCIONES':'CONDICIONES / EXCEPCIONES'
}


def col_index(ref):
    letters = re.match(r'[A-Z]+', ref or '')
    if not letters: return 0
    n=0
    for c in letters.group(0): n=n*26+ord(c)-64
    return n-1


def read_xlsx(path):
    with zipfile.ZipFile(path) as z:
        shared=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            root=ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in root.findall('a:si', NS):
                shared.append(''.join(t.text or '' for t in si.iter('{%s}t'%NS['a'])))
        wb=ET.fromstring(z.read('xl/workbook.xml'))
        rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        relmap={r.attrib['Id']:r.attrib['Target'] for r in rels}
        sheets=[]
        for sh in wb.find('a:sheets',NS):
            name=sh.attrib.get('name','Hoja')
            rid=sh.attrib.get('{%s}id'%NS['r'])
            target=relmap.get(rid,'')
            if target.startswith('/'): p=target.lstrip('/')
            else: p='xl/'+target.replace('../','')
            sheets.append((name,p))
        out=[]
        for sheet_name,p in sheets:
            if p not in z.namelist(): continue
            root=ET.fromstring(z.read(p))
            rows=[]
            for row in root.findall('.//a:sheetData/a:row',NS):
                vals={}
                for c in row.findall('a:c',NS):
                    idx=col_index(c.attrib.get('r','A1')); typ=c.attrib.get('t')
                    v=c.find('a:v',NS); inline=c.find('a:is',NS)
                    text=''
                    if typ=='s' and v is not None:
                        try:text=shared[int(v.text)]
                        except:text=''
                    elif typ=='inlineStr' and inline is not None:
                        text=''.join(t.text or '' for t in inline.iter('{%s}t'%NS['a']))
                    elif v is not None: text=v.text or ''
                    vals[idx]=text.strip() if isinstance(text,str) else text
                if vals:
                    mx=max(vals); rows.append([vals.get(i,'') for i in range(mx+1)])
            if rows: out.append((sheet_name,rows))
        return out


def infer_company(sheet_name):
    n=norm(sheet_name)
    for company in ['MAPFRE','PACIFICO','RIMAC','SANITAS','LA POSITIVA']:
        if company in n:
            return {'PACIFICO':'Pacífico','RIMAC':'Rímac','MAPFRE':'Mapfre','SANITAS':'Sanitas','LA POSITIVA':'La Positiva'}[company]
    return ''


def parse_listas_xlsx(path):
    records=[]; warnings=[]
    for sheet_name,rows in read_xlsx(path):
        header_i=None; mapping={}
        for i,row in enumerate(rows[:25]):
            cand={}
            for j,val in enumerate(row):
                key=HEADER_MAP.get(norm(val))
                if key: cand[j]=key
            has_service = ('TECNOLOGÍA' in cand.values() or 'SERVICIO O PROCEDIMIENTO' in cand.values())
            if has_service and (len(cand)>=3 or 'LISTA' in cand.values()):
                header_i=i; mapping=cand; break
        if header_i is None:
            continue
        sheet_company=infer_company(sheet_name)
        for row in rows[header_i+1:]:
            rec={}
            for j,key in mapping.items():
                rec[key]=(row[j] if j < len(row) else '').strip()
            if not rec.get('TECNOLOGÍA') and rec.get('SERVICIO O PROCEDIMIENTO'):
                rec['TECNOLOGÍA']=rec.get('SERVICIO O PROCEDIMIENTO','')
            if not rec.get('SERVICIO O PROCEDIMIENTO') and rec.get('TECNOLOGÍA'):
                rec['SERVICIO O PROCEDIMIENTO']=rec.get('TECNOLOGÍA','')
            if not rec.get('TECNOLOGÍA'): continue
            if not rec.get('COMPAÑÍA') and sheet_company: rec['COMPAÑÍA']=sheet_company
            rec.setdefault('COMPAÑÍA','')
            rec.setdefault('SUB CIA','')
            rec.setdefault('ID','')
            lista=norm(rec.get('LISTA','')).replace('LISTA ','').strip()
            if lista in ('A','B','AB'): rec['LISTA']=lista
            else: rec['LISTA']=rec.get('LISTA','') or 'AB'
            rec.setdefault('SERVICIO O PROCEDIMIENTO', rec.get('TECNOLOGÍA',''))
            for k in ['COBERTURA','CONDICIONES','EXCEPCIONES','DETALLES','PALABRAS CLAVE','REQUIERE CG']:
                rec.setdefault(k,'')
            if not rec.get('CONDICIONES / EXCEPCIONES'):
                parts=[]
                if rec.get('CONDICIONES'): parts.append('Condiciones: '+rec['CONDICIONES'])
                if rec.get('EXCEPCIONES'): parts.append('Excepciones: '+rec['EXCEPCIONES'])
                rec['CONDICIONES / EXCEPCIONES']='\n'.join(parts)
            records.append(rec)
    if not records: raise ValueError('No se detectaron filas válidas de LISTAS AB. Verifica que el Excel tenga encabezados como IAFA/COMPAÑÍA, LISTA y TECNOLOGÍA/PRESTACIÓN.')
    companies={}
    for r in records:
        c=r.get('COMPAÑÍA') or 'Sin IAFA'
        companies[c]=companies.get(c,0)+1
    if 'Mapfre' in companies or 'MAPFRE' in companies:
        pass
    return records, companies, warnings



def _sheet_header(rows, required_any, scan=20):
    """Return (header_index, normalized_header->column index)."""
    for i,row in enumerate(rows[:scan]):
        mp={norm(v):j for j,v in enumerate(row) if str(v or '').strip()}
        if all(any(k in mp for k in group) for group in required_any):
            return i,mp
    return None,{}

def _cell(row, mp, *names):
    for name in names:
        j=mp.get(norm(name))
        if j is not None and j < len(row):
            v=row[j]
            return str(v).strip() if v is not None else ''
    return ''

def _join_labeled(parts):
    out=[]
    for label,val in parts:
        val=str(val or '').strip()
        if val: out.append(f'{label}: {val}')
    return '\n'.join(out)

def parse_capacitaciones_master(path):
    """Parse the simplified Capacitaciones master.

    Preferred format:
      - CAPACITACIONES: 10 editable columns used by the Hub/Darbot.
      - FUENTE_DOCUMENTAL: technical source layer with full page/slide text.
      - DOCUMENTOS: document inventory (not published as answers by itself).
    Falls back to the legacy detailed format for compatibility.
    """
    sheets=read_xlsx(path)
    sheetmap={norm(n):(n,r) for n,r in sheets}
    records=[]; warnings=[]; skipped=0; curated_rows=0; source_rows=0

    simple=sheetmap.get('CAPACITACIONES')
    if simple:
        _,rows=simple
        hi,mp=_sheet_header(rows,[['ID'],['IAFA'],['PREGUNTA O SITUACION'],['RESPUESTA / REGLA']])
        if hi is None:
            raise ValueError('La hoja CAPACITACIONES existe, pero no se reconocieron los encabezados esperados.')
        for row in rows[hi+1:]:
            rid=_cell(row,mp,'ID')
            iafa=_cell(row,mp,'IAFA')
            producto=_cell(row,mp,'Producto')
            tema=_cell(row,mp,'Tema')
            pregunta=_cell(row,mp,'Pregunta o situación')
            respuesta=_cell(row,mp,'Respuesta / Regla')
            accion=_cell(row,mp,'Qué hacer')
            fuente=_cell(row,mp,'Fuente')
            pagina=_cell(row,mp,'Página')
            estado=norm(_cell(row,mp,'Estado'))
            if not any([rid,iafa,pregunta,respuesta]): continue
            if estado in ('INACTIVO','BORRADOR','ELIMINADO'):
                skipped+=1; continue
            if not respuesta: continue
            records.append({
                'id':rid or f'CAP-{len(records)+1:05d}','tipo_registro':'CAPACITACION',
                'iafas':iafa or 'Institucional','producto':producto or 'General','grupo':tema or 'General','categoria':tema or 'General',
                'tema':tema or pregunta,'pregunta':pregunta or tema,'respuesta':respuesta,'resumen':respuesta,
                'accion':accion,'decision':accion,'revisar':'','alerta':'','alertas':'',
                'fuente':fuente or 'Maestro de Capacitaciones IAFAS','pagina':pagina or '-', 'pagelink':pagina or '',
                'pdf':'','archivo_fuente':'','keywords':' '.join([iafa,producto,tema,pregunta,respuesta,accion,fuente]),
                'aliases':'','origen_maestro':'CAPACITACIONES'
            })
            curated_rows+=1

        src=sheetmap.get('FUENTE_DOCUMENTAL')
        if src:
            _,rows2=src
            hi2,mp2=_sheet_header(rows2,[['ID_FUENTE'],['IAFA'],['TEXTO FUENTE COMPLETO']])
            if hi2 is not None:
                for row in rows2[hi2+1:]:
                    rid=_cell(row,mp2,'ID_FUENTE')
                    iafa=_cell(row,mp2,'IAFA')
                    producto=_cell(row,mp2,'Producto')
                    tema=_cell(row,mp2,'Tema')
                    doc=_cell(row,mp2,'Documento')
                    year=_cell(row,mp2,'Año')
                    pagina=_cell(row,mp2,'Página / diapositiva')
                    texto=_cell(row,mp2,'Texto fuente completo')
                    archivo=_cell(row,mp2,'Archivo fuente')
                    metodo=_cell(row,mp2,'Método extracción')
                    revision=_cell(row,mp2,'Revisión visual')
                    estado=norm(_cell(row,mp2,'Estado'))
                    if not texto: continue
                    if estado in ('INACTIVO','BORRADOR','ELIMINADO'):
                        skipped+=1; continue
                    title=tema or doc or 'Contenido documental'
                    records.append({
                        'id':rid or f'F-{source_rows+1:05d}','tipo_registro':'FUENTE',
                        'iafas':iafa or 'Institucional','producto':producto or 'General','grupo':tema or 'Fuente documental','categoria':'Fuente documental',
                        'tema':title,'pregunta':title,'respuesta':texto,'resumen':texto,
                        'accion':'','decision':'','revisar':'','alerta':'','alertas':'',
                        'fuente':doc or archivo or 'Fuente documental','pagina':pagina or '-', 'pagelink':pagina or '',
                        'pdf':'','archivo_fuente':archivo,'anio':year,'metodo_extraccion':metodo,'revision_visual':revision,
                        'keywords':' '.join([iafa,producto,tema,doc,year,texto,archivo]),'aliases':doc,'origen_maestro':'FUENTE_DOCUMENTAL'
                    })
                    source_rows+=1
        companies={}
        for r in records:
            c=r.get('iafas') or 'Sin IAFA'; companies[c]=companies.get(c,0)+1
        return records,companies,{'curated_rows':curated_rows,'source_rows':source_rows,'skipped':skipped,'warnings':warnings}

    # --- Legacy fallback (v4.2.133 and prior) ---
    detail_rows=0
    detailed=next(((n,r) for n,r in sheets if norm(n)=='MAESTRO_DETALLADO'),None)
    if detailed:
        _,rows=detailed
        hi,mp=_sheet_header(rows,[['ID'],['IAFA / ENTIDAD'],['CONTENIDO FUENTE COMPLETO']])
        if hi is not None:
            for row in rows[hi+1:]:
                rid=_cell(row,mp,'ID'); content=_cell(row,mp,'CONTENIDO FUENTE COMPLETO')
                if not rid and not content: continue
                estado=norm(_cell(row,mp,'Estado')); accion_raw=_cell(row,mp,'Acción')
                if estado in ('INACTIVO','ELIMINADO') or norm(accion_raw) in ('ELIMINAR','BORRAR'):
                    skipped+=1; continue
                if not content: continue
                iafa=_cell(row,mp,'IAFA / Entidad') or 'Institucional'; doc=_cell(row,mp,'Documento / Capacitación'); archivo=_cell(row,mp,'Archivo fuente'); page=_cell(row,mp,'Página / diapositiva'); categoria=_cell(row,mp,'Categoría') or 'Contenido documental'; tipo=_cell(row,mp,'Tipo de contenido') or 'Información / Definición'
                records.append({'id':rid or f'MD-{len(records)+1:05d}','tipo_registro':'FUENTE','iafas':iafa,'producto':'General','grupo':categoria,'categoria':tipo,'tema':categoria,'pregunta':categoria,'respuesta':content,'resumen':content,'accion':'','decision':'','revisar':'','alerta':'','alertas':'','fuente':doc or archivo or 'Fuente documental','pagina':page or '-','pagelink':page or '','pdf':'','archivo_fuente':archivo,'keywords':' '.join([iafa,doc,archivo,categoria,tipo,content]),'aliases':doc,'origen_maestro':'MAESTRO_DETALLADO'})
                detail_rows+=1
    curated=next(((n,r) for n,r in sheets if norm(n)=='MAESTRO_UNIFICADO'),None)
    if curated:
        _,rows=curated
        hi,mp=_sheet_header(rows,[['ID'],['IAFA'],['TEMA / PREGUNTA']])
        if hi is not None:
            for row in rows[hi+1:]:
                rid=_cell(row,mp,'ID')
                if not rid: continue
                estado=norm(_cell(row,mp,'Estado')); action_raw=_cell(row,mp,'Acción')
                if estado in ('INACTIVO','ELIMINADO') or norm(action_raw) in ('ELIMINAR','BORRAR'):
                    skipped+=1; continue
                iafa=_cell(row,mp,'IAFA') or 'Institucional'; grupo=_cell(row,mp,'Grupo') or 'Capacitación'; categoria=_cell(row,mp,'Categoría') or grupo; tema=_cell(row,mp,'Tema / Pregunta'); respuesta=_cell(row,mp,'Resumen / Respuesta'); accion=_cell(row,mp,'Decisión / Acción operativa'); fuente=_cell(row,mp,'Fuente') or 'Maestro de Capacitaciones IAFAS'; page=_cell(row,mp,'Página')
                records.append({'id':'CUR-'+rid,'tipo_registro':'CAPACITACION','iafas':iafa,'producto':'General','grupo':grupo,'categoria':categoria,'tema':tema,'pregunta':tema,'respuesta':respuesta,'resumen':respuesta,'accion':accion,'decision':accion,'revisar':_cell(row,mp,'Qué revisar'),'alerta':_cell(row,mp,'Alerta'),'alertas':_cell(row,mp,'Alerta'),'fuente':fuente,'pagina':page or '-','pagelink':_cell(row,mp,'Página link') or page or '','pdf':_cell(row,mp,'Archivo PDF'),'keywords':_cell(row,mp,'Palabras clave'),'aliases':_cell(row,mp,'Alias'),'origen_maestro':'Maestro_Unificado'})
                curated_rows+=1
    if not records:
        raise ValueError('No se detectó información publicable en el maestro de Capacitaciones.')
    companies={}
    for r in records:
        c=r.get('iafas') or 'Sin IAFA'; companies[c]=companies.get(c,0)+1
    return records,companies,{'detail_rows':detail_rows,'curated_rows':curated_rows,'skipped':skipped,'warnings':warnings}

def current_cap_master_meta():
    jf=STATIC/'capacitaciones-maestro.json'; xf=ROOT/'MAESTRO-CAPACITACIONES-IAFAS.xlsx'
    count=0; companies=0
    if jf.exists():
        try:
            data=json.loads(jf.read_text('utf-8')); count=len(data); companies=len({r.get('iafas','') for r in data if r.get('iafas')})
        except: pass
    return {'name':xf.name if xf.exists() else 'MAESTRO-CAPACITACIONES-IAFAS.xlsx','bytes':xf.stat().st_size if xf.exists() else 0,
            'modified':dt.datetime.fromtimestamp(xf.stat().st_mtime).isoformat() if xf.exists() else None,'records':count,'companies':companies}

def write_cap_master(records):
    payload=json.dumps(records,ensure_ascii=False,separators=(',',':'))
    (STATIC/'capacitaciones-maestro.json').write_text(payload,'utf-8')
    (STATIC/'capacitaciones-maestro.js').write_text('window.CAPACITACIONES_MAESTRO='+payload+';\n','utf-8')

def load_state():
    if STATE.exists():
        try:return json.loads(STATE.read_text('utf-8'))
        except:pass
    return {'history':[]}

def save_state(st): STATE.write_text(json.dumps(st,ensure_ascii=False,indent=2),'utf-8')


def current_listas_meta():
    f=STATIC/'listas-ab-data.js'
    return {'name':'listas-ab-data.js','bytes':f.stat().st_size if f.exists() else 0,'modified':dt.datetime.fromtimestamp(f.stat().st_mtime).isoformat() if f.exists() else None}

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self,path):
        path=unquote(path.split('?',1)[0].split('#',1)[0]).lstrip('/')
        return str((ROOT/path).resolve())
    def end_headers(self):
        self.send_header('Cache-Control','no-store, no-cache, must-revalidate')
        super().end_headers()
    def json_response(self,obj,status=200):
        b=json.dumps(obj,ensure_ascii=False).encode('utf-8')
        self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
    def read_json(self):
        n=int(self.headers.get('Content-Length','0') or 0); raw=self.rfile.read(n)
        return json.loads(raw.decode('utf-8') or '{}')
    def do_GET(self):
        if self.path.split('?',1)[0]=='/api/sources':
            st=load_state(); cur=current_listas_meta()
            sources=[{'type':'listas_ab','label':'LISTAS AB','current':cur},{'type':'capacitaciones_master','label':'Maestro de Capacitaciones IAFAS','current':current_cap_master_meta()},{'type':'peas','label':'PEAS','current':{}},{'type':'manual','label':'Manual de Normas','current':{}},{'type':'capacitacion','label':'Capacitación / documento IAFA','current':{'documents':0}}]
            return self.json_response({'ok':True,'sources':sources,'history':st.get('history',[])})
        return super().do_GET()
    def do_POST(self):
        p=self.path.split('?',1)[0]
        try:
            body=self.read_json()
            if p=='/api/source/preview':
                fn=os.path.basename(body.get('filename') or 'fuente.xlsx'); typ=body.get('type') or 'auto'
                if not fn.lower().endswith('.xlsx'):
                    raise ValueError('La actualización directa de este Centro usa archivos Excel (.xlsx).')
                uid=uuid.uuid4().hex[:12]; up=UPLOADS/(uid+'.xlsx'); up.write_bytes(base64.b64decode(body.get('content') or ''))
                # Automatic detection prioritizes the training master by its sheet structure.
                if typ=='auto':
                    try:
                        records,companies,meta=parse_capacitaciones_master(up); typ='capacitaciones_master'
                    except Exception:
                        records,companies,warnings=parse_listas_xlsx(up); meta={'warnings':warnings}; typ='listas_ab'
                elif typ=='capacitaciones_master':
                    records,companies,meta=parse_capacitaciones_master(up)
                elif typ=='listas_ab':
                    records,companies,warnings=parse_listas_xlsx(up); meta={'warnings':warnings}
                else:
                    raise ValueError('En esta versión local la carga directa está habilitada para LISTAS AB y Maestro de Capacitaciones IAFAS.')
                parsed=UPLOADS/(uid+'.json'); parsed.write_text(json.dumps(records,ensure_ascii=False),'utf-8')
                if typ=='capacitaciones_master':
                    preview={'upload_id':uid,'type':typ,'label':'Maestro de Capacitaciones IAFAS','filename':fn,'bytes':up.stat().st_size,'current':current_cap_master_meta(),'detail':{'records':len(records),'companies':companies,'detail_rows':meta.get('detail_rows',0),'curated_rows':meta.get('curated_rows',0),'skipped':meta.get('skipped',0),'warning':' '.join(meta.get('warnings',[]))}}
                else:
                    preview={'upload_id':uid,'type':'listas_ab','label':'LISTAS AB','filename':fn,'bytes':up.stat().st_size,'current':current_listas_meta(),'detail':{'records':len(records),'companies':companies,'warning':' '.join(meta.get('warnings',[]))}}
                return self.json_response({'ok':True,'preview':preview})
            if p=='/api/source/publish':
                uid=body.get('upload_id',''); parsed=UPLOADS/(uid+'.json'); xlsx=UPLOADS/(uid+'.xlsx'); typ=body.get('type') or ''
                if not parsed.exists() or not xlsx.exists(): raise ValueError('La vista previa expiró. Vuelve a seleccionar el Excel.')
                records=json.loads(parsed.read_text('utf-8')); stamp=dt.datetime.now().strftime('%Y%m%d-%H%M%S'); backup=None
                st=load_state(); eid=uuid.uuid4().hex[:10]
                if typ=='capacitaciones_master':
                    target=STATIC/'capacitaciones-maestro.js'; target_json=STATIC/'capacitaciones-maestro.json'; master=ROOT/'MAESTRO-CAPACITACIONES-IAFAS.xlsx'
                    if target.exists():
                        backup=BACKUPS/f'capacitaciones-maestro-{stamp}.js'; shutil.copy2(target,backup)
                    if target_json.exists(): shutil.copy2(target_json,BACKUPS/f'capacitaciones-maestro-{stamp}.json')
                    if master.exists(): shutil.copy2(master,BACKUPS/f'MAESTRO-CAPACITACIONES-IAFAS-{stamp}.xlsx')
                    write_cap_master(records); shutil.copy2(xlsx,master)
                    label='Maestro de Capacitaciones IAFAS'
                elif typ=='listas_ab':
                    target=STATIC/'listas-ab-data.js'
                    if target.exists(): backup=BACKUPS/f'listas-ab-data-{stamp}.js'; shutil.copy2(target,backup)
                    target.write_text('window.LISTAS_AB_DATA='+json.dumps(records,ensure_ascii=False,separators=(',',':'))+';\n','utf-8')
                    shutil.copy2(xlsx,ROOT/'LISTAS-AB.xlsx'); label='LISTAS AB'
                else:
                    raise ValueError('Tipo de fuente no compatible con publicación directa.')
                companies=sorted({(r.get('iafas') if typ=='capacitaciones_master' else r.get('COMPAÑÍA','')) for r in records if (r.get('iafas') if typ=='capacitaciones_master' else r.get('COMPAÑÍA',''))})
                st.setdefault('history',[]).insert(0,{'id':eid,'type':typ,'label':label,'filename':body.get('title') or ('MAESTRO-CAPACITACIONES-IAFAS.xlsx' if typ=='capacitaciones_master' else 'LISTAS-AB.xlsx'),'version':body.get('version') or '', 'published_at':dt.datetime.now().isoformat(),'status':'published','backup':str(backup.name) if backup else ''})
                st['history']=st['history'][:30]; save_state(st)
                return self.json_response({'ok':True,'registros':len(records),'companies':companies})
            if p=='/api/source/restore':
                eid=body.get('event_id'); st=load_state(); ev=next((x for x in st.get('history',[]) if x.get('id')==eid),None)
                if not ev or not ev.get('backup'): raise ValueError('No se encontró respaldo para esa versión.')
                src=BACKUPS/ev['backup']
                if not src.exists(): raise ValueError('El archivo de respaldo ya no está disponible.')
                typ=ev.get('type')
                if typ=='capacitaciones_master': target=STATIC/'capacitaciones-maestro.js'; prefix='capacitaciones-maestro'
                elif typ=='listas_ab': target=STATIC/'listas-ab-data.js'; prefix='listas-ab-data'
                else: raise ValueError('Esta fuente no admite restauración automática.')
                cur=BACKUPS/f'{prefix}-before-restore-{dt.datetime.now().strftime("%Y%m%d-%H%M%S")}.js'
                if target.exists(): shutil.copy2(target,cur)
                shutil.copy2(src,target)
                st.setdefault('history',[]).insert(0,{'id':uuid.uuid4().hex[:10],'type':typ,'label':ev.get('label',''),'filename':ev.get('filename',''),'version':ev.get('version',''),'published_at':dt.datetime.now().isoformat(),'status':'restored','backup':cur.name if cur.exists() else ''}); save_state(st)
                return self.json_response({'ok':True})
            if p=='/api/data/update':
                xlsx=ROOT/'LISTAS-AB.xlsx'
                if not xlsx.exists(): raise ValueError('No se encontró LISTAS-AB.xlsx en la carpeta del Hub.')
                records,companies,_=parse_listas_xlsx(xlsx); (STATIC/'listas-ab-data.js').write_text('window.LISTAS_AB_DATA='+json.dumps(records,ensure_ascii=False,separators=(',',':'))+';\n','utf-8')
                return self.json_response({'ok':True,'registros':len(records),'companies':sorted(companies)})
            return self.json_response({'ok':False,'error':'Ruta API no disponible.'},404)
        except Exception as e:
            return self.json_response({'ok':False,'error':str(e)},400)

if __name__=='__main__':
    port=int(os.environ.get('PORT','8090'))
    os.chdir(ROOT)
    print('='*50); print(' IAFAS INTELLIGENCE HUB - SERVIDOR LOCAL'); print('='*50)
    print(f' Portal: http://localhost:{port}')
    print(' Centro de Fuentes: LISTAS AB + MAESTRO DE CAPACITACIONES habilitados')
    print(' Para cerrar: Ctrl+C')
    ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()
