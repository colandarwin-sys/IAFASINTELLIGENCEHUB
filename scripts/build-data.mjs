import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'LISTAS-AB-ACTUALIZADO.xlsx');
const OUTPUT = path.join(ROOT, 'static', 'listas-ab-data.js');

const norm = (v='') => String(v ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toUpperCase().trim().replace(/\s+/g,' ');

const HEADER_MAP = {
  'COMPANIA':'COMPAÑÍA','IAFA':'COMPAÑÍA','ASEGURADORA':'COMPAÑÍA','FINANCIADOR':'COMPAÑÍA',
  'SUB CIA':'SUB CIA','SUBCIA':'SUB CIA','SUB COMPANIA':'SUB CIA','PRODUCTO':'SUB CIA','PLAN':'SUB CIA',
  'ID':'ID','CODIGO':'ID','CODIGO ID':'ID','COD':'ID','LISTA':'LISTA','TIPO LISTA':'LISTA','LISTA AB':'LISTA',
  'TECNOLOGIA':'TECNOLOGÍA','PRESTACION':'TECNOLOGÍA','DESCRIPCION':'TECNOLOGÍA','SERVICIO':'TECNOLOGÍA','PROCEDIMIENTO':'TECNOLOGÍA','SERVICIO O PROCEDIMIENTO':'SERVICIO O PROCEDIMIENTO',
  'COBERTURA':'COBERTURA','ESTADO COBERTURA':'COBERTURA','CONDICIONES':'CONDICIONES','CONDICION':'CONDICIONES',
  'EXCEPCIONES':'EXCEPCIONES','EXCEPCION':'EXCEPCIONES','DETALLES':'DETALLES','DETALLE':'DETALLES','OBSERVACIONES':'DETALLES','OBSERVACION':'DETALLES',
  'PALABRAS CLAVE':'PALABRAS CLAVE','KEYWORDS':'PALABRAS CLAVE','REQUIERE CG':'REQUIERE CG','CARTA DE GARANTIA':'REQUIERE CG','REQUIERE CARTA DE GARANTIA':'REQUIERE CG',
  'CONDICIONES / EXCEPCIONES':'CONDICIONES / EXCEPCIONES','CONDICIONES/EXCEPCIONES':'CONDICIONES / EXCEPCIONES'
};

function rowsFromSheet(ws){
  return XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
}

function inferCompany(name){
  const n=norm(name);
  const vals=[['PACIFICO','Pacífico'],['RIMAC','Rímac'],['MAPFRE','Mapfre'],['SANITAS','Sanitas'],['LA POSITIVA','La Positiva'],['POSITIVA','Positiva']];
  for(const [needle,label] of vals) if(n.includes(needle)) return label;
  return '';
}

function parseListas(wb){
  const records=[];
  for(const sheetName of wb.SheetNames){
    const rows=rowsFromSheet(wb.Sheets[sheetName]);
    let hi=-1,mapping={};
    for(let i=0;i<Math.min(rows.length,25);i++){
      const cand={};
      rows[i].forEach((v,j)=>{const k=HEADER_MAP[norm(v)];if(k)cand[j]=k;});
      const vals=Object.values(cand);
      if((vals.includes('TECNOLOGÍA')||vals.includes('SERVICIO O PROCEDIMIENTO'))&&(vals.length>=3||vals.includes('LISTA'))){hi=i;mapping=cand;break;}
    }
    if(hi<0) continue;
    const sheetCompany=inferCompany(sheetName);
    for(const row of rows.slice(hi+1)){
      const rec={};
      for(const [j,k] of Object.entries(mapping)) rec[k]=String(row[Number(j)]??'').trim();
      if(!rec['TECNOLOGÍA']&&rec['SERVICIO O PROCEDIMIENTO']) rec['TECNOLOGÍA']=rec['SERVICIO O PROCEDIMIENTO'];
      if(!rec['SERVICIO O PROCEDIMIENTO']&&rec['TECNOLOGÍA']) rec['SERVICIO O PROCEDIMIENTO']=rec['TECNOLOGÍA'];
      if(!rec['TECNOLOGÍA']) continue;
      if(!rec['COMPAÑÍA']&&sheetCompany) rec['COMPAÑÍA']=sheetCompany;
      for(const k of ['COMPAÑÍA','SUB CIA','ID','LISTA','COBERTURA','CONDICIONES','EXCEPCIONES','DETALLES','PALABRAS CLAVE','REQUIERE CG']) rec[k]=rec[k]||'';
      if(!rec['CONDICIONES / EXCEPCIONES']) rec['CONDICIONES / EXCEPCIONES']=[rec.CONDICIONES&&`Condiciones: ${rec.CONDICIONES}`,rec.EXCEPCIONES&&`Excepciones: ${rec.EXCEPCIONES}`].filter(Boolean).join('\n');
      records.push(rec);
    }
  }
  if(!records.length) throw new Error('No se detectaron filas válidas de LISTAS AB. Verifica los encabezados del Excel.');
  return records;
}

if(!fs.existsSync(SOURCE)){
  console.error(`No existe ${path.basename(SOURCE)} en la raíz del repositorio.`);
  process.exit(1);
}

const wb=XLSX.readFile(SOURCE,{cellDates:false});
const records=parseListas(wb);
fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
fs.writeFileSync(OUTPUT,`window.LISTAS_AB_DATA=${JSON.stringify(records)};\n`,'utf8');
const companies={};
for(const r of records){const c=r['COMPAÑÍA']||'Sin IAFA';companies[c]=(companies[c]||0)+1;}
console.log(`LISTAS AB generadas: ${records.length} registros`);
console.log(companies);
