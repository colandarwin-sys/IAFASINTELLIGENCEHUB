let data=window.LISTAS_AB_DATA||[];
const MODULES={
  inicio:{name:'Inicio',group:'Inicio'},
  miniia:{name:'Darbot',group:'Inicio'},
  buscador:{name:'Listas AB',group:'Coberturas'},
  exclusiones:{name:'Exclusiones IAFAS',group:'Coberturas'},
  factores:{name:'Factores IAFAS',group:'Coberturas'},
  honorarios:{name:'Calculadora de Honorarios',group:'Operación'},
  manual:{name:'Manual de Normas de Facturación',group:'Biblioteca inteligente'},
  peas:{name:'PEAS',group:'Biblioteca inteligente'},
  capacitaciones:{name:'Capacitaciones IAFAS',group:'Biblioteca inteligente'},
  central:{name:'Central de consultas',group:'Operación'},
  contactos:{name:'Contactos y emergencias',group:'Operación'},
  glosario:{name:'Glosario / Terminología',group:'Operación'},
  usuarios:{name:'Gestión de usuarios',group:'Administración'},
  fuentes:{name:'Gestión de fuentes',group:'Administración'}
};
const ALL_ACCESS_MODULES=Object.keys(MODULES);
const ADMIN_ONLY_MODULES=['usuarios','fuentes'];
const NON_ADMIN_ACCESS_MODULES=ALL_ACCESS_MODULES.filter(id=>!ADMIN_ONLY_MODULES.includes(id));
const DEFAULT_USERS={
  dcolan:{password:'dcolan',displayName:'Darwen Colan',role:'Superadmin',allowed:ALL_ACCESS_MODULES,active:true,createdAt:'Base'},
  ctejada:{password:'ctejada',displayName:'Cindy Tejada',role:'Consulta rápida',allowed:NON_ADMIN_ACCESS_MODULES,active:true,createdAt:'Base'},
  autorizaciones:{password:'autorizaciones',displayName:'Central de Autorizaciones',role:'Operativo',allowed:NON_ADMIN_ACCESS_MODULES,active:true,createdAt:'Base'},
  farmacia:{password:'farmacia',displayName:'Central de Farmacia',role:'Operativo',allowed:NON_ADMIN_ACCESS_MODULES,active:true,createdAt:'Base'},
  adt:{password:'adt',displayName:'ADT',role:'Operativo',allowed:NON_ADMIN_ACCESS_MODULES,active:true,createdAt:'Base'},
  emergencia:{password:'emergencia',displayName:'Caja Emergencia',role:'Operativo',allowed:NON_ADMIN_ACCESS_MODULES,active:true,createdAt:'Base'},
  ambulatoria:{password:'ambulatoria',displayName:'Caja Ambulatoria',role:'Operativo',allowed:NON_ADMIN_ACCESS_MODULES,active:true,createdAt:'Base'},
  cav:{password:'cav',displayName:'Central de Atención Virtual',role:'Operativo',allowed:NON_ADMIN_ACCESS_MODULES,active:true,createdAt:'Base'}
};
let USERS={};
let sessionUser=null;
let editingUser=null;
let activeFilter='ALL';
let activeCompanyFilter='ALL';
let listasAbHasSearched=false;
let current=[];
const CAPACITACIONES=window.CAPACITACIONES||[];
const CAPACITACIONES_QA=window.CAPACITACIONES_QA||[];
const CAPACITACIONES_MAESTRO=window.CAPACITACIONES_MAESTRO||[];
const capData=CAPACITACIONES_MAESTRO.length?CAPACITACIONES_MAESTRO:(CAPACITACIONES_QA.length?[...CAPACITACIONES,...CAPACITACIONES_QA]:CAPACITACIONES);
const THEME_STORAGE_KEY='iafas_hub_theme_v4275';
function normalizeUserName(value){return String(value||'').trim().toLowerCase();}
function userModulesForRole(role){return role==='Superadmin'?ALL_ACCESS_MODULES:NON_ADMIN_ACCESS_MODULES;}
function loadUsers(){
  let saved={};
  try{saved=JSON.parse(localStorage.getItem('iafas_hub_users_v423')||'{}')||{};}catch(_e){saved={};}
  USERS={...saved};
  Object.entries(DEFAULT_USERS).forEach(([name,info])=>{USERS[name]={...info};});
  localStorage.setItem('iafas_hub_users_v423',JSON.stringify(USERS));
  return USERS;
}
function saveUsers(){
  Object.entries(DEFAULT_USERS).forEach(([name,info])=>{USERS[name]={...info};});
  localStorage.setItem('iafas_hub_users_v423',JSON.stringify(USERS));
}
USERS=loadUsers();

function $(id){return document.getElementById(id)}
function hasExtendedExceptions(r){const exc=String(r['EXCEPCIONES']||'').trim();if(!exc||/^(no aplica|sin excepciones)\.?$/i.test(exc))return false;return exc.length>=300;}
function statusOf(r){const cov=(r['COBERTURA']||'').toLowerCase();const cg=String(r['REQUIERE CG']||'').toLowerCase();if(hasExtendedExceptions(r))return ['review','Revisar excepciones'];if(cg.startsWith('s'))return ['cg','Requiere Carta de Garantía'];if(/no cobert/.test(cov))return ['no','No cubierto'];if(cg.startsWith('n'))return ['ok','No requiere Carta de Garantía'];if(/restringida|condicionada|sujeta a|evaluaci[oó]n/i.test(cov))return ['rest','Validación requerida'];return ['rest','Validar información'];}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function hasAbValue(value,kind='generic'){const v=String(value||'').trim();if(!v)return false;const n=v.toLowerCase().replace(/\s+/g,' ').replace(/[.]$/,'');if(['no aplica','no aplica.','n/a','na','ninguna','ninguno','sin condición','sin condiciones','sin excepcion','sin excepción','sin excepciones'].includes(n))return false;if(kind==='cond'&&/^sin excepciones?$/.test(n))return false;return true;}
function abCgLabel(value){const v=String(value||'').trim().toLowerCase();if(v.startsWith('s'))return ['cg','Requiere Carta de Garantía'];if(v.startsWith('n'))return ['ok','No requiere Carta de Garantía'];return ['rest','No especificado en la fila'];}
function toggleAbDetail(id,btn,showLabel,hideLabel){const el=$(id);if(!el)return;const willShow=el.hidden;el.hidden=!willShow;if(btn)btn.innerText=willShow?hideLabel:showLabel;}
function resetAbExpandable(){['conditionsDetail','exceptionsDetail'].forEach(id=>{const el=$(id);if(el)el.hidden=true;});if($('conditionsBtn'))$('conditionsBtn').innerText='Ver condiciones';if($('exceptionsBtn'))$('exceptionsBtn').innerText='Ver excepciones';}
function menuBtn(id){return document.querySelector(`[data-module="${id}"]`);}
function act(b){document.querySelectorAll('.menu button').forEach(x=>x.classList.remove('active')); if(b)b.classList.add('active');}
function canPage(id){return !!sessionUser && (sessionUser.allowed.includes('*') || sessionUser.allowed.includes(id));}
function go(id,b){if(!canPage(id)){alert('Este usuario no tiene acceso a esta sección.');return;}if(id==='miniia'&&typeof openDarwenChat==='function'){act(b||menuBtn(id));openDarwenChat();return;}const target=$(id);if(!target){alert('La sección solicitada todavía no está disponible.');return;}act(b||menuBtn(id));document.querySelectorAll('.page').forEach(x=>x.classList.remove('show'));target.classList.add('show'); if(id==='buscador') renderListasABIdle(); if(id==='exclusiones') renderExclusiones(); if(id==='factores') renderFactoresIdle(); if(id==='honorarios') honInit(); if(id==='capacitaciones') renderCapacitaciones(); if(id==='manual') renderManual(); if(id==='peas') renderPeas(); if(id==='usuarios')renderUsersAdmin(); if(id==='fuentes')loadSourceCenter();}

const FACTORES_IAFAS=window.FACTORES_IAFAS_DATA||[];
let factoresHasSearched=false;
function factorNorm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function factorDisplay(v){const s=String(v??'').trim();if(!s||s==='None')return 'No indicado';if(/por validar/i.test(s))return 'Por validar';return s;}
function factorIsNumeric(v){return /^\d+(?:\.\d+)?$/.test(String(v??'').trim());}
function factorSearchRows(query){
  const q=factorNorm(query);if(!q)return [];
  const aliases={pacifico:['pacifico'],rimac:['rimac'],mapfre:['mapfre'],sanitas:['sanitas'],'la positiva':['la positiva','positiva'],'garantia de salud':['garantia de salud','iafas garantia de salud']};
  let tokens=q.split(/\s+/).filter(Boolean);
  for(const [key,vals] of Object.entries(aliases)){if(vals.some(a=>q.includes(a))){tokens=factorNorm(key).split(/\s+/);break;}}
  return FACTORES_IAFAS.filter(r=>{
    const hay=factorNorm([r.IAFA,r.NOMBRE_REGLA,r.NOMBRE_CONVENIO,r.NOMBRE_PLAN_SALUD,r.TIPO_CONVENIO,r.ESTADO].join(' '));
    return tokens.every(tok=>hay.includes(tok));
  }).sort((a,b)=>{
    const aa=(String(a.CONVENIO_ACTIVO).toUpperCase()==='ACTIVO'?0:1)+(String(a.ESTADO).toUpperCase()==='ACTIVO'?0:2)+(factorIsNumeric(a['FACTOR HONORARIO'])?0:4);
    const bb=(String(b.CONVENIO_ACTIVO).toUpperCase()==='ACTIVO'?0:1)+(String(b.ESTADO).toUpperCase()==='ACTIVO'?0:2)+(factorIsNumeric(b['FACTOR HONORARIO'])?0:4);
    return aa-bb||String(a.IAFA).localeCompare(String(b.IAFA),'es');
  });
}
function factorSummary(rows,key){
  const active=rows.filter(r=>String(r.CONVENIO_ACTIVO).toUpperCase()==='ACTIVO'&&String(r.ESTADO).toUpperCase()==='ACTIVO');
  const pool=active.length?active:rows;
  const numeric=[...new Set(pool.map(r=>String(r[key]??'').trim()).filter(factorIsNumeric))];
  const validations=pool.filter(r=>/por validar/i.test(String(r[key]??''))).length;
  if(numeric.length===1)return {value:numeric[0],note:validations?`${validations} regla(s) adicional(es) por validar`:'Factor común en las reglas activas'};
  if(numeric.length>1)return {value:'Varía',note:`Valores encontrados: ${numeric.join(' · ')}`};
  if(validations)return {value:'Por validar',note:'Consultar con Convenios'};
  const vals=[...new Set(pool.map(r=>factorDisplay(r[key])).filter(v=>v&&v!=='No indicado'))];
  return {value:vals[0]||'No indicado',note:vals.length>1?'Revisar detalle por regla':'Según la información fuente'};
}
function renderFactoresIdle(){if(!factoresHasSearched){if($('factorEmpty'))$('factorEmpty').hidden=false;if($('factorResults'))$('factorResults').hidden=true;}}
function clearFactores(){factoresHasSearched=false;if($('factor_q'))$('factor_q').value='';renderFactoresIdle();if($('factorCount'))$('factorCount').innerText=FACTORES_IAFAS.length+' registros fuente';}
function setFactorQuery(q){if($('factor_q'))$('factor_q').value=q;renderFactores();}
function renderFactores(){
  const query=$('factor_q')?.value||'';factoresHasSearched=true;const rows=factorSearchRows(query);
  if($('factorCount'))$('factorCount').innerText=rows.length+' coincidencias';
  if(!rows.length){if($('factorEmpty')){$('factorEmpty').hidden=false;$('factorEmpty').innerHTML='<div class="empty-state"><b>No encontré factores para esa búsqueda.</b><span>Prueba con el nombre de la IAFA, convenio, plan o regla.</span></div>';}if($('factorResults'))$('factorResults').hidden=true;return;}
  if($('factorEmpty'))$('factorEmpty').hidden=true;if($('factorResults'))$('factorResults').hidden=false;
  const honor=factorSummary(rows,'FACTOR HONORARIO'),serv=factorSummary(rows,'FACTOR SERVICIO');
  $('factorHonorario').innerText=honor.value;$('factorHonorarioNote').innerText=honor.note;
  $('factorServicios').innerText=serv.value;$('factorServiciosNote').innerText=serv.note;
  const companies=[...new Set(rows.map(r=>r.IAFA).filter(Boolean))];
  $('factorCompany').innerText=companies.length===1?companies[0]:(companies.length+' compañías relacionadas');
  $('factorCompanyNote').innerText=companies.length===1?`${rows.length} regla(s) / plan(es) encontrados`:companies.slice(0,3).join(' · ')+(companies.length>3?' · …':'');
  $('factorMatchCount').innerText=rows.length+' coincidencias';
  $('factorResultHint').innerText=(honor.value==='Varía'||serv.value==='Varía'||honor.value==='Por validar'||serv.value==='Por validar')?'El factor depende de la regla o existe información pendiente de validación. Revisa el detalle antes de comunicarlo.':'Los registros coincidentes muestran un factor consistente; revisa el plan/regla si necesitas el sustento específico.';
  $('factorTableBody').innerHTML=rows.map(r=>{
    const active=String(r.ESTADO).toUpperCase()==='ACTIVO'&&String(r.CONVENIO_ACTIVO).toUpperCase()==='ACTIVO';
    const h=factorDisplay(r['FACTOR HONORARIO']),s=factorDisplay(r['FACTOR SERVICIO']);
    return `<tr class="${active?'factor-active':'factor-inactive'}"><td><b>${esc(r.IAFA)}</b><div class="sub">${esc(r.TIPO_CONVENIO||'')}</div></td><td><b>${esc(r.NOMBRE_REGLA||'-')}</b><div class="sub">${esc(r.NOMBRE_CONVENIO||'')}</div></td><td>${esc(r.NOMBRE_PLAN_SALUD||'-')}<div class="sub">Código ${esc(r.CODIGO_PLAN_SALUD||'-')}</div></td><td><span class="factor-state ${active?'is-active':'is-inactive'}">${active?'Activo':'Inactivo'}</span></td><td><span class="factor-value ${h==='Por validar'?'needs-check':''}">${esc(h)}</span></td><td><span class="factor-value ${s==='Por validar'?'needs-check':''}">${esc(s)}</span></td></tr>`;
  }).join('');
}

function setListasABEmpty(title='Sin búsqueda activa',hint='Busca una prestación para ver coincidencias y detalle sustentado.',state='Sin búsqueda'){$('cnt').innerText='0 registros';$('tb').innerHTML='<tr><td colspan="4"><div class="empty-state">Ingresa una búsqueda para mostrar las coincidencias de Listas AB.</div></td></tr>';$('tec').innerText=title;$('detailHint').innerText=hint;$('l').innerText='-';$('l').className='badgeA';$('c').innerText='-';if($('conditionsState'))$('conditionsState').innerText='-';if($('exceptionsState'))$('exceptionsState').innerText='-';if($('cond'))$('cond').innerText='-';if($('exc'))$('exc').innerText='-';if($('detalles'))$('detalles').innerText='-';$('p').innerHTML='';$('cg').innerText='-';if($('conditionsBtn'))$('conditionsBtn').hidden=true;if($('exceptionsBtn'))$('exceptionsBtn').hidden=true;if($('decisionCompany'))$('decisionCompany').innerText=activeCompanyFilter==='ALL'?'Todas':activeCompanyFilter;resetAbExpandable();}
function renderListasABIdle(){if(!listasAbHasSearched)setListasABEmpty();else render(filtered());}
function clearListasABSearch(){listasAbHasSearched=false;activeFilter='ALL';if($('q'))$('q').value='';document.querySelectorAll('#buscador .filter button').forEach((x,i)=>x.classList.toggle('active',i===0));setListasABEmpty();}
function filtered(){let arr=data;if(activeCompanyFilter!=='ALL')arr=arr.filter(r=>r['COMPAÑÍA']===activeCompanyFilter);if(!['ALL','CG','NO'].includes(activeFilter))arr=arr.filter(r=>r.LISTA===activeFilter);if(activeFilter==='CG')arr=arr.filter(r=>(r['REQUIERE CG']||'').toLowerCase().startsWith('s'));if(activeFilter==='NO')arr=arr.filter(r=>/no cobert/.test((r['COBERTURA']||'').toLowerCase()));const q=($('q')?.value||'').toLowerCase().trim();if(q)arr=arr.filter(r=>JSON.stringify(r).toLowerCase().includes(q));return listasAbHasSearched?arr:[];}
function render(arr){current=arr;$('cnt').innerText=arr.length+' registros';if(!listasAbHasSearched){setListasABEmpty();return;}if(!arr.length){$('tb').innerHTML='<tr><td colspan="4"><div class="empty-state">No se encontraron registros con los filtros actuales.</div></td></tr>';$('tec').innerText='Sin resultados';$('detailHint').innerText='Ajusta la búsqueda o cambia el filtro.';$('l').innerText='-';$('c').innerText='-';if($('conditionsState'))$('conditionsState').innerText='-';if($('exceptionsState'))$('exceptionsState').innerText='-';if($('cond'))$('cond').innerText='-';if($('exc'))$('exc').innerText='-';if($('detalles'))$('detalles').innerText='-';$('p').innerHTML='';$('cg').innerText='-';if($('conditionsBtn'))$('conditionsBtn').hidden=true;if($('exceptionsBtn'))$('exceptionsBtn').hidden=true;resetAbExpandable();return;}$('tb').innerHTML=arr.map((r,i)=>{const st=statusOf(r),badge=r.LISTA==='A'?'badgeA':r.LISTA==='B'?'badgeB':'badgeAB';return `<tr data-i="${i}"><td class="code">${esc(r.ID)}</td><td><span class="${badge}">Lista ${esc(r.LISTA)}</span></td><td><div class="tech">${esc(r['TECNOLOGÍA'])}</div><div class="sub">${esc([r['COMPAÑÍA'],r['SUB CIA']].filter(Boolean).join(' · '))}</div><div class="sub">${esc(r['COBERTURA']||'Cobertura no especificada')}</div></td><td><span class="status ${st[0]}">${st[1]}</span></td></tr>`}).join('');document.querySelectorAll('#tb tr').forEach(tr=>tr.onclick=()=>det(parseInt(tr.dataset.i),tr));det(0,document.querySelector('#tb tr'));}
function det(i,tr){
  document.querySelectorAll('#tb tr').forEach(x=>x.classList.remove('sel'));
  if(tr)tr.classList.add('sel');
  const r=current[i];
  if(!r)return;
  $('tec').innerText=r['TECNOLOGÍA']||'';
  $('l').innerText='Lista '+(r.LISTA||'');
  $('l').className=r.LISTA==='A'?'badgeA':r.LISTA==='B'?'badgeB':'badgeAB';
  $('c').innerText=r['COBERTURA']||'No especificado en la fila.';
  const hasCond=hasAbValue(r['CONDICIONES'],'cond');
  const hasExc=hasAbValue(r['EXCEPCIONES'],'exc');
  if($('conditionsState')){ $('conditionsState').innerText=hasCond?'Sí tiene condiciones':'No tiene condiciones'; $('conditionsState').className='ab-state-pill '+(hasCond?'has':'none'); }
  if($('exceptionsState')){ $('exceptionsState').innerText=hasExc?'Sí tiene excepciones':'No tiene excepciones'; $('exceptionsState').className='ab-state-pill '+(hasExc?'has':'none'); }
  if($('cond'))$('cond').innerText=hasCond?(r['CONDICIONES']||''):'No aplica.';
  if($('exc'))$('exc').innerText=hasExc?(r['EXCEPCIONES']||''):'No aplica.';
  if($('conditionsBtn'))$('conditionsBtn').hidden=!hasCond;
  if($('exceptionsBtn'))$('exceptionsBtn').hidden=!hasExc;
  resetAbExpandable();
  if($('detalles'))$('detalles').innerText=hasAbValue(r['DETALLES'])?r['DETALLES']:'Sin detalle adicional.';
  $('p').innerHTML=(r['PALABRAS CLAVE']||'').split(',').map(x=>x.trim()).filter(Boolean).map(x=>`<span class="chip">${esc(x)}</span>`).join('');
  const cg=abCgLabel(r['REQUIERE CG']);
  $('cg').innerHTML=`<span class="ab-cg-pill ${cg[0]}">${esc(cg[1])}</span>`;
  $('detailHint').innerText=[r.ID,[r['COMPAÑÍA'],r['SUB CIA']].filter(Boolean).join(' · ')].filter(Boolean).join(' · ')+' seleccionado';
  if($('decisionCompany'))$('decisionCompany').innerText=[r['COMPAÑÍA'],r['SUB CIA']].filter(Boolean).join(' · ')||'Pacífico';
}
function renderCompanyFilters(){const host=$('abCompanyFilters');if(!host)return;const companies=[...new Set(data.map(r=>r['COMPAÑÍA']).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));host.innerHTML=['ALL',...companies].map(c=>`<button class="${c===activeCompanyFilter?'active':''}" onclick="companyFilter('${esc(c).replace(/'/g,'&#39;')}',this)">${c==='ALL'?'Todas las IAFAS':esc(c)}</button>`).join('');renderListTypeFilters();}
function renderListTypeFilters(){const host=$('abTypeFilters');if(!host)return;const lists=[...new Set(data.map(r=>String(r.LISTA||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));host.innerHTML=`<button class="${activeFilter==='ALL'?'active':''}" onclick="filtro('ALL',this)">Todo</button>`+lists.map(l=>`<button class="${activeFilter===l?'active':''}" onclick="filtro('${esc(l).replace(/'/g,'&#39;')}',this)">Lista ${esc(l)}</button>`).join('')+`<button class="${activeFilter==='CG'?'active':''}" onclick="filtro('CG',this)">Requiere CG</button><button class="${activeFilter==='NO'?'active':''}" onclick="filtro('NO',this)">No cubierto</button>`;}
function renderUpdateStatus(){const s=window.DATA_UPDATE_STATUS||{};if($('dataUpdateStatus'))$('dataUpdateStatus').innerText=`${s.registros||data.length} registros · ${Object.keys(s.companias||{}).length||new Set(data.map(r=>r['COMPAÑÍA'])).size} IAFAS`;}
function init(){const total=data.length,a=data.filter(r=>r.LISTA==='A').length,b=data.filter(r=>r.LISTA==='B').length,ab=data.filter(r=>r.LISTA==='AB').length,cg=data.filter(r=>(r['REQUIERE CG']||'').toLowerCase().startsWith('s')).length;$('kTotal').innerText=total;$('kA').innerText=a;$('kB').innerText=b+ab;$('kCG').innerText=cg;$('mA').style.width=Math.round(a*100/total)+'%';$('mB').style.width=Math.round((b+ab)*100/total)+'%';$('mCG').style.width=Math.round(cg*100/total)+'%';if($('quickView'))$('quickView').innerHTML=bar('Lista A',a,total)+bar('Lista B / AB',b+ab,total,'teal')+bar('Requieren CG',cg,total,'amber')+data.slice(0,5).map(itemHtml).join('');renderCompanyFilters();renderUpdateStatus();renderListasABIdle();renderExclusiones();renderCapacitaciones();renderManual();renderPeas();}
function buscar(){listasAbHasSearched=true;render(filtered());}
function filtro(t,b){
  activeFilter=t;
  listasAbHasSearched=true;
  document.querySelectorAll('#buscador .ab-type-filter button').forEach(x=>x.classList.remove('active'));
  if(b)b.classList.add('active');
  render(filtered());
}
function companyFilter(company,b){activeCompanyFilter=company;listasAbHasSearched=true;document.querySelectorAll('#abCompanyFilters button').forEach(x=>x.classList.remove('active'));if(b)b.classList.add('active');render(filtered());}
function decisionHint(kind){if(kind==='review')return 'La regla contiene excepciones extensas que deben revisarse antes de concluir.';if(kind==='no')return 'La prestación figura como no cubierta en el registro consultado.';if(kind==='cg')return 'Gestionar Carta de Garantía según la condición documentada.';if(kind==='rest')return 'La regla requiere validar condiciones específicas antes de concluir.';return 'El registro consultado no exige Carta de Garantía.';}
function csvValue(value){return `"${String(value ?? '').replaceAll('"','""')}"`;}
function exportarCSV(){const rows=listasAbHasSearched?(current.length?current:filtered()):[];if(!rows.length){alert('No hay registros para exportar.');return;}const cols=['COMPAÑÍA','SUB CIA','ID','LISTA','TECNOLOGÍA','COBERTURA','CONDICIONES','EXCEPCIONES','DETALLES','CONDICIONES / EXCEPCIONES','PALABRAS CLAVE','REQUIERE CG'];const csv=[cols.map(csvValue).join(',')].concat(rows.map(r=>cols.map(c=>csvValue(r[c])).join(','))).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='listas_ab_filtrado.csv';a.click();URL.revokeObjectURL(url);}
async function runLocalUpdate(){const msg=$('localUpdateMessage');if(msg)msg.innerText='Validando archivos...';try{if(typeof window.hubApi!=='function')throw new Error('Abre el portal con abrir-portal-local.cmd para actualizar datos.');const result=await window.hubApi('/api/data/update',{method:'POST',body:'{}'});if(msg)msg.innerText=`Actualización completada: ${result.registros} registros. Recargando...`;setTimeout(()=>location.reload(),1200);}catch(err){if(msg)msg.innerText=err.message||'No se pudo aplicar la actualización.';}}
let activeCapFilter='ALL';
let capCurrent=capData;
let capGuideCurrentId='QA-003';
const capGuideMeta={
  'QA-001':{icon:'⚡',label:'Emergencias',title:'Emergencia accidental',example:'Si el accidente ocurrió hoy y la atención inicial se realiza dentro de las 48 horas, la orientación debe distinguir entre atención inicial y continuaciones ambulatorias de hasta 90 días.'},
  'QA-003':{icon:'⏳',label:'Conceptos',title:'Carencia',example:'Si el afiliado recién ingresó al plan, no asumas cobertura integral. Primero revisa si sigue en carencia y si tiene continuidad que la exonere.'},
  'QA-011':{icon:'🔄',label:'Conceptos',title:'Continuidad',example:'Cuando el paciente viene de otro seguro o tiene continuidad registrada, puede quedar exonerado de carencia. Debe validarse en Observaciones de SITEDS.'},
  'QA-023':{icon:'⛔',label:'Conceptos',title:'Exclusión',example:'Si una prestación figura como excluida, no cierres la respuesta de inmediato. Primero confirma si existe una excepción o una condición que cambie la regla.'},
  'QA-024':{icon:'🧩',label:'Conceptos',title:'Excepción',example:'Una exclusión puede habilitarse si se cumple una condición específica. El paso clave es identificar esa condición y contrastarla con el documento aplicable.'},
  'QA-005':{icon:'🧾',label:'SITEDS',title:'SITEDS',example:'Antes de orientar cobertura, revisa plan, beneficio, observaciones, exclusiones, topes y mecanismo de pago. El nombre del plan por sí solo no basta.'},
  'QA-015':{icon:'📘',label:'PEAS',title:'PEAS',example:'El PEAS orienta la revisión de cobertura, pero no reemplaza el plan ni la póliza. Úsalo como referencia y luego contrasta con el documento vigente.'},
  'QA-012':{icon:'🛡️',label:'Conceptos',title:'Carta de Garantía',example:'Si el procedimiento requiere Carta de Garantía, valida su emisión y las condiciones aprobadas antes de comunicar cobertura al paciente.'}
};
// v4.2.68: microvideos retirados; el modulo de Capacitaciones sera redisenado desde cero.
const capTrainingVideos=[];
let capVideoIndex=0;
function capVideoRender(){return;}
function capVideoMove(){return;}
function capVideoTogglePlay(){return;}
function capVideoForGuide(){return;}
const capStop=new Set(['que','es','la','el','los','las','de','del','un','una','se','en','para','por','al','y','o','cuanto','cuantos','cuanta','cuantas','cubre','cubren','aplica','aplican','beneficio','asegurado','paciente']);
function capGuidePool(){return Object.keys(capGuideMeta).map(id=>capData.find(x=>x.id===id)).filter(Boolean);}
function capGuideChecksText(r){return String(r?.revisar||'').split(/,| y /).map(x=>x.trim()).filter(Boolean).slice(0,4);}
function capGuideInfo(r){const meta=capGuideMeta[r?.id]||{};return {icon:meta.icon||'📘',label:meta.label||r?.grupo||'Conceptos',title:meta.title||r?.pregunta||r?.tema||'Concepto',example:meta.example||r?.accion||'Aplicar la regla y contrastar con el documento vigente.'};}
function capGuideCard(r){const info=capGuideInfo(r);return `<button class="cap-guide-card${capGuideCurrentId===r.id?' sel':''}" onclick="capSelectGuide('${r.id}')"><div class="icon">${info.icon}</div><div class="mini"><span>${esc(info.label)}</span><span>p. ${esc(r.pagina)}</span></div><strong>${esc(info.title)}</strong><p>${esc(r.respuesta||r.resumen||'')}</p><div class="cta">Ver concepto →</div></button>`;}
function renderCapGuide(){if(!$('capGuideCards'))return;const pool=capGuidePool();if(!pool.length)return;if(!pool.some(x=>x.id===capGuideCurrentId))capGuideCurrentId=pool[0].id;$('capGuideCards').innerHTML=pool.map(capGuideCard).join('');const current=pool.find(x=>x.id===capGuideCurrentId)||pool[0];const info=capGuideInfo(current);if($('capMetricCount'))$('capMetricCount').innerText=capData.length;if($('capMetricTopics'))$('capMetricTopics').innerText=new Set(capData.map(x=>x.grupo)).size;if($('capGuideGroup'))$('capGuideGroup').innerText=info.label;if($('capGuidePage'))$('capGuidePage').innerText='p. '+current.pagina;if($('capGuideTitle'))$('capGuideTitle').innerText=info.title;if($('capGuideDefinition'))$('capGuideDefinition').innerText=current.respuesta||current.resumen||'-';if($('capGuideExample'))$('capGuideExample').innerText=info.example;const checks=capGuideChecksText(current);if($('capGuideChecks'))$('capGuideChecks').innerHTML=(checks.length?checks:['Revisar la fuente vigente aplicable.']).map(x=>`<li>${esc(x)}</li>`).join('');const gl=$('capGuideLink');if(gl)gl.href=`static/docs/capacitacion-lineamientos-convenios-2026.pdf#page=${current.pagelink||String(current.pagina).split(' ')[0]}`;if(!$('capVideoDots')?.children.length)capVideoRender(0);}
function capSelectGuide(id){capGuideCurrentId=id;renderCapGuide();capVideoForGuide(id);}
function capUseGuideQuestion(){const pool=capGuidePool();const current=pool.find(x=>x.id===capGuideCurrentId)||pool[0];if(current)capSetQuery(current.pregunta||current.tema||'');}
function capNorm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function capTokens(q){return capNorm(q).split(/\s+/).filter(x=>x&& !capStop.has(x));}
function capFilter(t,b){activeCapFilter=t;document.querySelectorAll('#capacitaciones .cap-topic-filter button').forEach(x=>x.classList.remove('active'));if(b)b.classList.add('active');renderCapacitaciones();}
function capScore(x,q){const n=capNorm(q),tokens=capTokens(q);const question=capNorm(x.pregunta||x.tema);const aliases=capNorm(x.aliases);const keys=capNorm(x.keywords);const answer=capNorm(x.respuesta||x.resumen);const all=[question,aliases,keys,answer].join(' ');let score=0;if(!n)return 1;if(question===n)score+=500;if(question.includes(n)||aliases.includes(n))score+=180;tokens.forEach(tok=>{if(question.includes(tok))score+=35;if(aliases.includes(tok))score+=30;if(keys.includes(tok))score+=22;if(answer.includes(tok))score+=8;if(all.includes(tok))score+=3;});const must=tokens.filter(tok=>tok.length>=4);if(must.length&&must.every(tok=>all.includes(tok)))score+=80;return score;}
function capOncologyQuery(q){return /\b(oncol|cancer|tumor|neoplas|quimio|radioterap|pet\s*scan|anatomia\s*patologica)/i.test(capNorm(q));}
function filteredCaps(){let arr=capData;const q=($('cap_q')?.value||'').trim();if(q&&capOncologyQuery(q))return capData.filter(x=>x.id==='QA-009');if(activeCapFilter!=='ALL')arr=arr.filter(x=>x.grupo===activeCapFilter);if(q){arr=arr.map(x=>({...x,_score:capScore(x,q)})).filter(x=>x._score>=22).sort((a,b)=>b._score-a._score);}return arr;}
function capCard(r,i){const title=r.pregunta||r.tema;const answer=r.respuesta||r.resumen;return `<button class="cap-topic-card" data-i="${i}" onclick="capDetail(${i},this)"><div class="cap-topic-top"><span class="cap-topic-group">${esc(r.grupo)}</span><span class="cap-topic-page">p. ${esc(r.pagina)}</span></div><strong>${esc(title)}</strong><p>${esc(answer)}</p><span class="cap-topic-action">Ver respuesta →</span></button>`;}
function capSetQuery(q){const el=$('cap_q');if(!el)return;el.value=q;activeCapFilter='ALL';document.querySelectorAll('#capacitaciones .cap-topic-filter button').forEach((x,i)=>x.classList.toggle('active',i===0));renderCapacitaciones();el.focus();}
function renderCapacitaciones(){if(!$('capCards'))return;renderCapGuide();const q=($('cap_q')?.value||'').trim();capCurrent=filteredCaps();$('capCount').innerText=capCurrent.length+(q?' respuestas':' preguntas');if(!capCurrent.length){$('capCards').innerHTML='<div class="empty-state">No encontré una respuesta sustentada en esta capacitación.</div>';if($('capTitle'))$('capTitle').innerText='Respuesta no encontrada';if($('capResumen'))$('capResumen').innerText='Respuesta no encontrada en la capacitación cargada.';if($('capDecision'))$('capDecision').innerText='Revisar otra fuente vigente o escalar la consulta si se necesita resolver el caso.';if($('capReq'))$('capReq').innerText='-';if($('capAlertas'))$('capAlertas').innerText='No se mostrará una respuesta inferida sin sustento.';if($('capFuente'))$('capFuente').innerText='Fuente no encontrada';if($('capKeywords'))$('capKeywords').innerHTML='';return;}$('capCards').innerHTML=capCurrent.map(capCard).join('');capDetail(0,document.querySelector('#capCards .cap-topic-card'));}
function capDetail(i,tr){document.querySelectorAll('#capCards .cap-topic-card').forEach(x=>x.classList.remove('sel'));if(tr)tr.classList.add('sel');const r=capCurrent[i];if(!r)return;const title=r.pregunta||r.tema;const answer=r.respuesta||r.resumen;$('capIafas').innerText=r.estado==='no_identificado'?'No especificado':r.grupo;$('capTitle').innerText=title;$('capResumen').innerText=answer;$('capDecision').innerText=r.accion||r.decision||'Revisar la fuente antes de concluir.';$('capReq').innerText=r.revisar||'-';$('capAlertas').innerText=r.alerta||r.alertas||'-';$('capFuente').innerText=r.pagina?`${r.fuente} · p. ${r.pagina}`:r.fuente;$('capKeywords').innerHTML=(r.keywords||'').split(/[, ]+/).map(x=>x.trim()).filter(Boolean).slice(0,12).map(x=>`<span class="chip">${esc(x)}</span>`).join('');const l=$('capPageLink');if(l){const hasCustomPdf=Object.prototype.hasOwnProperty.call(r,'pdf');const pdf=hasCustomPdf?r.pdf:'static/docs/capacitacion-lineamientos-convenios-2026.pdf';l.hidden=!pdf;if(pdf)l.href=`${pdf}#page=${r.pagelink||String(r.pagina).split(' ')[0]}`;}if(capGuideMeta[r.id]){capGuideCurrentId=r.id;renderCapGuide();capVideoForGuide(r.id);}}
let activeExcType='ALL';
let activeExcCompany='ALL';
let excCurrent=[];
function excTypeFilter(t,b){activeExcType=t;document.querySelectorAll('#exclusiones .filter button').forEach(x=>x.classList.remove('active'));if(b)b.classList.add('active');renderExclusiones();}
function excCompanyFilter(t,b){activeExcCompany=t;document.querySelectorAll('#exclusiones .company-filter button').forEach(x=>x.classList.remove('active'));if(b)b.classList.add('active');renderExclusiones();}
function excScore(r,q){const text=normText([r.id,r.tipo,r.grupo,r.iafas,r.resumen,r.regla,r.keywords].join(' '));const phrase=normText(q);const tokens=phrase.match(/[a-z0-9.]{2,}/g)||[];let score=0;if(phrase&&text.includes(phrase))score+=120;tokens.forEach(t=>{if(normText(r.grupo).includes(t))score+=35;if(normText(r.iafas).includes(t))score+=18;if(normText(r.keywords).includes(t))score+=22;if(text.includes(t))score+=8;});if(r.tipo==='Regla particular')score+=6;return score;}
function filteredExclusiones(){let arr=window.EXCLUSIONES_IAFAS||[];if(activeExcType!=='ALL')arr=arr.filter(x=>x.tipo===activeExcType);if(activeExcCompany!=='ALL'){const c=normText(activeExcCompany);arr=arr.filter(x=>normText([x.grupo,x.iafas,x.resumen,x.keywords].join(' ')).includes(c));}const q=($('exc_q')?.value||'').trim();if(q){arr=arr.map(x=>({...x,_score:excScore(x,q)})).filter(x=>x._score>0).sort((a,b)=>b._score-a._score);}else{arr=arr.map((x,i)=>({...x,_score:100-i}));}return arr;}
function excChecklistItems(r){const items=['Confirmar IAFA, producto, plan y vigencia antes de responder.','Revisar PEAS, continuidad legal, SCTR, programa o beneficio específico.','Contrastar la matriz con póliza, contrato, anexo, tarifario o regla operativa vigente.'];if(!r)return items;if(/experimental|off label|digemid|fda|ema|evidencia/i.test(r.keywords))return ['Validar evidencia clínica y aprobación regulatoria aplicable.','Confirmar registro DIGEMID, FDA/EMA o criterio técnico exigido por la IAFA.',...items.slice(0,2)];if(/preexist|congenita|sctr|autolesion/i.test(r.keywords))return ['Confirmar causal del evento, periodo de espera y continuidad legal.','Revisar si corresponde SCTR, PEAS o excepción de salud mental documentada.',...items.slice(0,2)];if(/protesis|ortesis|cpap|dispositivo|equipo/i.test(r.keywords))return ['Confirmar si el equipo o dispositivo está expresamente cubierto.','Separar procedimiento, dispositivo, insumo y alquiler/compra antes de responder.',...items.slice(0,2)];return items;}
function renderExclusionDecision(r){if(!$('excDecision'))return;if(!r){$('excDecision').innerHTML='<div class="empty-state">No encontré coincidencias. Prueba con otra palabra clave, IAFA o tecnología.</div>';renderExclusionSide(null);return;}const keywords=(r.keywords||'').split(/\s+/).filter(Boolean).slice(0,12);$('excDecision').innerHTML=`<div class="exclusion-verdict"><span class="status no">Alerta de exclusión</span><h3>${esc(r.grupo)}</h3><p>${esc(r.resumen)}</p><div class="field"><b>Regla práctica</b><div>${esc(r.regla)}</div></div><div class="chips">${keywords.map(k=>`<span class="chip">${esc(k)}</span>`).join('')}</div></div>`;renderExclusionSide(r);}
function exclusionIafasList(value){const raw=String(value||'').trim();if(!raw)return [];const known=['Rimac Seguros','Rimac EPS','Pacifico Seguros','Pacifico EPS','Sanitas','La Positiva Seguros','La Positiva EPS','Mapfre Seguros','Mapfre EPS','Garantia'];const hits=known.filter(name=>normText(raw).includes(normText(name)));return hits.length?hits:[raw];}
function renderExclusionSide(r){if(!$('excSideMeta'))return;if(!r){$('excSideMeta').innerHTML='<div class="empty-state">Selecciona una alerta para ver las IAFAS a las que aplica la exclusión.</div>';return;}const iafas=exclusionIafasList(r.iafas);$('excSideMeta').innerHTML=`<div class="exclusion-side-box iafas"><b>IAFAS a las que aplica la exclusión</b><ul class="exclusion-iafas-list">${iafas.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;}
function renderExclusionChecklist(r){if(!$('excChecklist'))return;$('excChecklist').innerHTML=excChecklistItems(r).map(x=>`<li>${esc(x)}</li>`).join('');}
function renderExclusiones(){if(!$('excDecision'))return;excCurrent=filteredExclusiones();if($('excCount'))$('excCount').innerText=excCurrent.length+' coincidencias';const best=excCurrent[0];renderExclusionDecision(best);renderExclusionChecklist(best);}
function exclusionDetail(i){const r=excCurrent[i];if(!r)return;renderExclusionDecision(r);renderExclusionChecklist(r);}
function clearExclusiones(){if($('exc_q'))$('exc_q').value='';activeExcType='ALL';activeExcCompany='ALL';document.querySelectorAll('#exclusiones .filter button').forEach((x,i)=>x.classList.toggle('active',i===0));document.querySelectorAll('#exclusiones .company-filter button').forEach((x,i)=>x.classList.toggle('active',i===0));renderExclusiones();}
let activeManualFilter='ALL';
let manualCurrent=(window.manualData&&window.manualData.length?window.manualData:manualData);
const manualRecords=(window.manualData&&window.manualData.length?window.manualData:manualData.map((x,i)=>({id:'MNF-FALLBACK-'+i,page:x.page||1,chapterId:x.categoria||'manual',chapter:x.categoria||'Manual',chapterPages:String(x.page||''),heading:x.tema||'Norma',text:[x.resumen,x.sustento,x.uso,x.alerta].filter(Boolean).join('\n'),keywords:x.keywords||''})));
const manualChapters=(window.manualChapters&&window.manualChapters.length?window.manualChapters:[...new Map(manualRecords.map(x=>[x.chapterId,{id:x.chapterId,title:x.chapter,pages:x.chapterPages,count:manualRecords.filter(r=>r.chapterId===x.chapterId).length}])).values()]);
const manualExcludedSearchSections=new Set(['indice','glosario','anexos']);
function manualAllowedForSearch(r){return !manualExcludedSearchSections.has(String(r.chapterId||'').toLowerCase());}
function manualTitle(r){return r.heading||r.tema||r.title||'Norma';}
function manualBody(r){return r.text||[r.resumen,r.sustento,r.uso,r.alerta].filter(Boolean).join('\n')||'';}
function manualKind(r){return r.chapter||r.categoria||'Manual';}
const manualStop=new Set(['como','cuando','donde','para','porque','sobre','segun','cual','cuales','tiene','debe','deben','esta','este','estos','estas','manual','norma','normas','factura','facturacion','medica','medico','auditoria','paciente','pacientes','hacer','puede','pueden','cuanto','cuantos']);
function normText(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function manualTokens(q){return normText(q).match(/[a-z0-9]{3,}/g)?.filter(w=>!manualStop.has(w))||[];}
function manualFilter(t,b){activeManualFilter=t;document.querySelectorAll('#manualChapterList .manual-chapter').forEach(x=>x.classList.remove('active'));if(b)b.classList.add('active');renderManual();}
function clearManualSearch(){if($('manual_q'))$('manual_q').value='';activeManualFilter='ALL';renderManual();}
function manualScore(r,tokens,phrase){const base=normText([manualKind(r),manualTitle(r),manualBody(r),r.keywords].join(' '));let score=0;if(phrase&&base.includes(phrase))score+=80;tokens.forEach(tok=>{if(normText(manualTitle(r)).includes(tok))score+=18;if(normText(manualKind(r)).includes(tok))score+=8;if(normText(r.keywords).includes(tok))score+=8;const safe=tok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const hits=(base.match(new RegExp(safe,'g'))||[]).length;score+=Math.min(hits,8)*5;});return score;}
function filteredManual(){let arr=manualRecords;if(activeManualFilter!=='ALL')arr=arr.filter(x=>x.chapterId===activeManualFilter);const q=($('manual_q')?.value||'').trim();const phrase=normText(q);const tokens=manualTokens(q);if(!q)return [];arr=arr.filter(manualAllowedForSearch);return arr.map(r=>({...r,_score:manualScore(r,tokens,phrase)})).filter(r=>r._score>0).sort((a,b)=>b._score-a._score||a.page-b.page);}
function renderManualChapters(){if(!$('manualChapterList'))return;const total=manualRecords.length;const allActive=activeManualFilter==='ALL'?' active':'';$('manualChapterList').innerHTML=`<button class="manual-chapter${allActive}" onclick="manualFilter('ALL',this)"><b>Todos los capítulos</b><span>${total} bloques textuales</span></button>`+manualChapters.map(c=>`<button class="manual-chapter${activeManualFilter===c.id?' active':''}" onclick="manualFilter('${esc(c.id)}',this)"><b>${esc(c.title)}</b><span>p. ${esc(c.pages)} · ${c.count} bloques</span></button>`).join('');}
function linkPdf(page){return 'static/docs/manual-normas-facturacion.pdf#page='+page;}
function manualCitation(r){return `${esc(manualKind(r))} · p. ${r.page} · ${esc(r.id)}`;}
function manualCard(r,i){return `<article class="manual-result" onclick="manualDetail(${i})"><div class="manual-result-head"><span class="badgeA">p. ${r.page}</span><b>${esc(manualTitle(r))}</b></div><p>${esc(manualBody(r))}</p><div class="manual-result-foot"><span>${manualCitation(r)}</span><a href="${linkPdf(r.page)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Ver PDF</a></div></article>`;}
function renderManual(){if(!$('manualResults'))return;const q=($('manual_q')?.value||'').trim();const listPanel=document.querySelector('#manual .manual-list-panel');manualCurrent=filteredManual();$('manualCount').innerText=manualCurrent.length+' resultados';if($('manualAnswer'))$('manualAnswer').style.display=q?'block':'none';if(listPanel)listPanel.style.display=q&&manualCurrent.length?'block':'none';if(!q){$('manualAnswer').innerHTML='';$('manualResults').innerHTML='';return;}if(!manualCurrent.length){$('manualAnswer').innerHTML='<div class="empty-state">No encontré una coincidencia textual. Prueba con menos palabras.</div>';$('manualResults').innerHTML='';return;}manualDetail(0);$('manualResults').innerHTML=manualCurrent.slice(0,24).map(manualCard).join('');}
function manualDetail(i){const r=manualCurrent[i];if(!r)return;const query=($('manual_q')?.value||'').trim();$('manualAnswer').innerHTML=`<div class="manual-answer-top"><div><span>Respuesta textual ${query?'para la búsqueda':'del capítulo'}</span><h3>${esc(manualTitle(r))}</h3></div><a class="source-link" href="${linkPdf(r.page)}" target="_blank" rel="noopener">Abrir página ${r.page}</a></div><blockquote>${esc(manualBody(r))}</blockquote><div class="manual-citation"><b>Cita:</b> ${manualCitation(r)}</div><div class="chips">${(r.keywords||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,10).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>`;document.querySelectorAll('.manual-result').forEach((x,idx)=>x.classList.toggle('sel',idx===i));}

let activePeasChapter='ALL';
let activePeasType='ALL';
let peasCurrent=[];
const peasStop=new Set(['como','cuando','donde','para','porque','sobre','segun','cual','cuales','tiene','debe','deben','esta','este','estos','estas','peas','plan','esencial','aseguramiento','salud','persona','paciente','pacientes','hacer','puede','pueden','esta','estan','incluye','cubierto','cobertura']);
function peasNorm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function peasTokens(q){return peasNorm(q).match(/[a-z0-9.]{2,}/g)?.filter(w=>!peasStop.has(w))||[];}
function peasPdf(page){return 'static/docs/peas.pdf#page='+page;}
function peasCitation(r){return `${esc(r.chapter||'PEAS')} · p. ${r.page} · ${esc(r.id||'PEAS')}`;}
function peasChapterFilter(id,b){activePeasChapter=id;document.querySelectorAll('#peasChapterList .manual-chapter').forEach(x=>x.classList.remove('active'));if(b)b.classList.add('active');renderPeas();}
function peasTypeFilter(type,b){activePeasType=type;document.querySelectorAll('.peas-type-filter button').forEach(x=>x.classList.remove('active'));if(b)b.classList.add('active');renderPeas();}
function clearPeasSearch(){if($('peas_q'))$('peas_q').value='';activePeasChapter='ALL';activePeasType='ALL';document.querySelectorAll('.peas-type-filter button').forEach((x,i)=>x.classList.toggle('active',i===0));renderPeas();}
function peasScoreText(text,tokens,phrase){const base=peasNorm(text);let score=0;if(phrase&&base.includes(phrase))score+=120;tokens.forEach(tok=>{const safe=tok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const hits=(base.match(new RegExp(safe,'g'))||[]).length;score+=Math.min(hits,10)*6;});return score;}
function buildPeasPool(){const pool=[];const conds=window.peasConditions||[];const procs=window.peasProcedures||[];const pages=window.peasPages||[];conds.forEach(c=>pool.push({type:'COND',id:c.id,page:c.page,chapterId:c.chapterId,chapter:c.chapter,heading:c.title,text:[c.definition,(c.cie10||[]).join('\n')].filter(Boolean).join('\n'),condition:c.title,cie10:c.cie10||[],raw:c}));procs.forEach(p=>pool.push({type:'PROC',id:p.id,page:p.page,chapterId:p.chapterId,chapter:p.chapter,heading:p.code+' - '+p.denomination,text:p.context||p.denomination,condition:p.condition,code:p.code,denomination:p.denomination,raw:p}));pages.forEach(p=>pool.push({type:'TEXT',id:p.id,page:p.page,chapterId:p.chapterId,chapter:p.chapter,heading:p.heading,text:p.text,raw:p}));return pool;}
function peasConditionKey(name){return peasNorm(name).replace(/\s+/g,' ').trim();}
function peasProceduresForCondition(name){const key=peasConditionKey(name);return (window.peasProcedures||[]).filter(p=>peasConditionKey(p.condition)===key);}
function peasConditionSearchText(c){const related=peasProceduresForCondition(c.title).slice(0,160);return [c.title,c.definition,(c.cie10||[]).join(' '),c.chapter,related.map(p=>[p.code,p.denomination,p.context].join(' ')).join(' ')].join(' ');}
function peasRelatedProcedures(c,q){const all=peasProceduresForCondition(c.title);const tokens=peasTokens(q||'');const phrase=peasNorm(q||'');if(!q)return all.slice(0,50);return all.map(p=>{const txt=[p.code,p.denomination,p.context,p.condition].join(' ');let score=peasScoreText(txt,tokens,phrase);if(tokens.some(t=>peasNorm(p.code).includes(t)))score+=120;if(score===0)score=1;return {...p,_score:score};}).sort((a,b)=>b._score-a._score||a.page-b.page).slice(0,80);}
function peasConditionMatchesFromProcedure(q){const tokens=peasTokens(q||'');const phrase=peasNorm(q||'');const map=new Map();(window.peasProcedures||[]).forEach(p=>{const text=[p.condition,p.code,p.denomination,p.context].join(' ');let score=peasScoreText(text,tokens,phrase);if(tokens.some(t=>peasNorm(p.code).includes(t)))score+=120;if(score>0){const key=peasConditionKey(p.condition);map.set(key,(map.get(key)||0)+score);}});return map;}
function filteredPeas(){
  const q=($('peas_q')?.value||'').trim();
  const phrase=peasNorm(q);
  const tokens=peasTokens(q);
  let conds=(window.peasConditions||[]);
  if(activePeasChapter!=='ALL')conds=conds.filter(c=>c.chapterId===activePeasChapter);
  if(activePeasType==='PROC'){
    let procs=(window.peasProcedures||[]);
    if(activePeasChapter!=='ALL')procs=procs.filter(p=>p.chapterId===activePeasChapter);
    if(!q)return procs.slice(0,120).map((p,i)=>({type:'PROC',id:p.id,page:p.page,chapterId:p.chapterId,chapter:p.chapter,heading:p.code+' - '+p.denomination,text:p.context||p.denomination,condition:p.condition,code:p.code,denomination:p.denomination,raw:p,_score:1000-i}));
    return procs.map(p=>{const text=[p.condition,p.code,p.denomination,p.context,p.chapter].join(' ');let score=peasScoreText(text,tokens,phrase);if(tokens.some(t=>peasNorm(p.code).includes(t)))score+=120;return {type:'PROC',id:p.id,page:p.page,chapterId:p.chapterId,chapter:p.chapter,heading:p.code+' - '+p.denomination,text:p.context||p.denomination,condition:p.condition,code:p.code,denomination:p.denomination,raw:p,_score:score};}).filter(r=>r._score>0).sort((a,b)=>b._score-a._score||a.page-b.page).slice(0,200);
  }
  if(activePeasType==='TEXT'){
    let pages=(window.peasPages||[]);
    if(activePeasChapter!=='ALL')pages=pages.filter(p=>p.chapterId===activePeasChapter);
    if(!q)return pages.slice(0,80).map((p,i)=>({type:'TEXT',id:p.id,page:p.page,chapterId:p.chapterId,chapter:p.chapter,heading:p.heading,text:p.text,raw:p,_score:1000-i}));
    return pages.map(p=>{const score=peasScoreText([p.heading,p.text,p.chapter].join(' '),tokens,phrase);return {type:'TEXT',id:p.id,page:p.page,chapterId:p.chapterId,chapter:p.chapter,heading:p.heading,text:p.text,raw:p,_score:score};}).filter(r=>r._score>0).sort((a,b)=>b._score-a._score||a.page-b.page).slice(0,120);
  }
  const procScores=peasConditionMatchesFromProcedure(q);
  if(!q)return conds.slice(0,120).map((c,i)=>({type:'COND',id:c.id,page:c.page,chapterId:c.chapterId,chapter:c.chapter,heading:c.title,text:c.definition||'',condition:c.title,cie10:c.cie10||[],raw:c,_score:1000-i,related:peasRelatedProcedures(c,'')}));
  return conds.map(c=>{let score=peasScoreText(peasConditionSearchText(c),tokens,phrase);score+=(procScores.get(peasConditionKey(c.title))||0);if(score>0)score+=50;return {type:'COND',id:c.id,page:c.page,chapterId:c.chapterId,chapter:c.chapter,heading:c.title,text:c.definition||'',condition:c.title,cie10:c.cie10||[],raw:c,_score:score,related:peasRelatedProcedures(c,q)};}).filter(r=>r._score>0).sort((a,b)=>b._score-a._score||a.page-b.page).slice(0,120);
}
function renderPeasChapters(){if(!$('peasChapterList'))return;const chapters=window.peasChapters||[];const stats=window.peasStats||{};const allActive=activePeasChapter==='ALL'?' active':'';$('peasChapterList').innerHTML=`<button class="manual-chapter${allActive}" onclick="peasChapterFilter('ALL',this)"><b>Todos los capítulos</b><span>${stats.pages||922} páginas · ${stats.conditions||0} condiciones · ${stats.procedures||0} prestaciones</span></button>`+chapters.map(c=>`<button class="manual-chapter${activePeasChapter===c.id?' active':''}" onclick="peasChapterFilter('${esc(c.id)}',this)"><b>${esc(c.title)}</b><span>p. ${esc(c.pages)} · ${c.count||0} páginas</span></button>`).join('');}
function peasKindLabel(t){return t==='COND'?'Condición asegurable':t==='PROC'?'Prestación / tabla':'Texto fuente';}
function peasCard(r,i){let body='';if(r.type==='COND'){body=`<p>${esc(r.text||'Condición asegurable registrada en el PEAS.')}</p>${(r.cie10&&r.cie10.length)?`<div class="chips">${r.cie10.slice(0,6).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>`:''}<div class="sub">${(r.related||[]).length} prestaciones / filas relacionadas</div>`;}else if(r.type==='PROC'){body=`<div class="peas-table-row"><span>Código</span><b>${esc(r.code)}</b><span>Denominación</span><b>${esc(r.denomination)}</b><span>Condición</span><b>${esc(r.condition)}</b></div><p>${esc(r.text)}</p>`;}else{body=`<p>${esc(r.text)}</p>`;}return `<article class="manual-result peas-result" onclick="peasDetail(${i})"><div class="manual-result-head"><span class="badgeA">p. ${r.page}</span><span class="status rest">${peasKindLabel(r.type)}</span><b>${esc(r.heading)}</b></div>${body}<div class="manual-result-foot"><span>${peasCitation(r)}</span><a href="${peasPdf(r.page)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Ver PDF</a></div></article>`;}
function renderPeas(){if(!$('peasResults'))return;const stats=window.peasStats||{};if($('peasPagesKpi'))$('peasPagesKpi').innerText=stats.pages||922;if($('peasCondKpi'))$('peasCondKpi').innerText=stats.conditions||0;if($('peasProcKpi'))$('peasProcKpi').innerText=stats.procedures||0;renderPeasChapters();peasCurrent=filteredPeas();$('peasCount').innerText=peasCurrent.length+' resultados';if($('peasChapterHint'))$('peasChapterHint').innerText=activePeasChapter==='ALL'?'Mostrando todos los capítulos.':'Filtrado por capítulo.';if(!peasCurrent.length){$('peasAnswer').innerHTML='<div class="empty-state">No encontré coincidencias. Prueba con CIE-10, nombre de diagnóstico, procedimiento o menos palabras.</div>';$('peasResults').innerHTML='';return;}peasDetail(0);$('peasResults').innerHTML=peasCurrent.map(peasCard).join('');}
function peasProcedureTable(rows){if(!rows||!rows.length)return '<div class="empty-state">No se encontraron prestaciones tabulares relacionadas para esta condición.</div>';return `<div class="peas-side-table"><table><thead><tr><th>Página</th><th>Código</th><th>Procedimiento / Prestación</th><th>Sustento / precisión</th></tr></thead><tbody>${rows.map(p=>`<tr><td><a href="${peasPdf(p.page)}" target="_blank" rel="noopener">p. ${p.page}</a></td><td><b>${esc(p.code||'')}</b></td><td>${esc(p.denomination||'')}</td><td>${esc((p.context||'').slice(0,260))}${(p.context||'').length>260?'...':''}</td></tr>`).join('')}</tbody></table></div>`;}
function peasDetail(i){const r=peasCurrent[i];if(!r)return;let detail='';if(r.type==='COND'){const rows=r.related||peasRelatedProcedures(r.raw, $('peas_q')?.value||'');detail=`<div class="peas-decision-layout"><div class="peas-general-card"><div class="field"><b>Diagnóstico / condición asegurable</b><p>${esc(r.heading)}</p></div><div class="field"><b>Información general del diagnóstico</b><blockquote>${esc(r.text||'El PEAS registra esta condición asegurable. Revisar las prestaciones y precisiones relacionadas en la tabla lateral.')}</blockquote></div>${(r.cie10&&r.cie10.length)?`<div class="field"><b>Diagnósticos CIE-10 relacionados</b><div class="peas-cie-list">${r.cie10.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`:''}<div class="manual-citation"><b>Fuente:</b> ${peasCitation(r)}</div></div><div class="peas-related-card"><div class="manual-answer-top compact"><div><span>Tabla relacionada del PEAS</span><h3>Prestaciones asociadas</h3></div><span class="pill blue">${rows.length} filas</span></div>${peasProcedureTable(rows)}</div></div>`;}else if(r.type==='PROC'){const cond=(window.peasConditions||[]).find(c=>peasConditionKey(c.title)===peasConditionKey(r.condition));const rows=cond?peasRelatedProcedures(cond,$('peas_q')?.value||r.code):[];detail=`<div class="peas-decision-layout"><div class="peas-general-card"><div class="field"><b>Condición asegurable</b><p>${esc(r.condition)}</p></div><div class="peas-table-detail"><div><span>Código del procedimiento</span><b>${esc(r.code)}</b></div><div><span>Denominación</span><b>${esc(r.denomination)}</b></div></div><blockquote>${esc(r.text)}</blockquote><div class="manual-citation"><b>Fuente:</b> ${peasCitation(r)}</div></div><div class="peas-related-card"><div class="manual-answer-top compact"><div><span>Tabla relacionada del PEAS</span><h3>Prestaciones de la misma condición</h3></div><span class="pill blue">${rows.length} filas</span></div>${peasProcedureTable(rows)}</div></div>`;}else{detail=`<blockquote>${esc(r.text)}</blockquote><div class="manual-citation"><b>Fuente:</b> ${peasCitation(r)}</div>`;}$('peasAnswer').innerHTML=`<div class="manual-answer-top"><div><span>${peasKindLabel(r.type)}</span><h3>${esc(r.heading)}</h3></div><a class="source-link" href="${peasPdf(r.page)}" target="_blank" rel="noopener">Abrir página ${r.page}</a></div>${detail}`;document.querySelectorAll('.peas-result').forEach((x,idx)=>x.classList.toggle('sel',idx===i));}


function syncVersion(){const el=document.querySelector('.app-version');if(el)el.textContent='IAFAS HUB v4.2.129 · LOGIN RESPONSIVE · 09SEP2026';}
function initMenuHover(){document.querySelectorAll('.menu button').forEach(btn=>{if(btn.dataset.hoverReady)return;btn.dataset.hoverReady='1';btn.addEventListener('mouseenter',()=>btn.classList.add('menu-hover'));btn.addEventListener('mouseleave',()=>btn.classList.remove('menu-hover'));btn.addEventListener('focus',()=>btn.classList.add('menu-hover'));btn.addEventListener('blur',()=>btn.classList.remove('menu-hover'));});}
function applyTheme(){const mode=localStorage.getItem(THEME_STORAGE_KEY)||'light';document.body.classList.toggle('light-theme',mode==='light');initMenuHover();const btn=$('themeToggle');if(btn){const label=mode==='light'?'Cambiar a modo oscuro':'Cambiar a modo claro';btn.title=label;btn.setAttribute('aria-label',label);}}
function toggleTheme(){const next=document.body.classList.contains('light-theme')?'dark':'light';localStorage.setItem(THEME_STORAGE_KEY,next);applyTheme();}

let activeIntelSource='ALL';
function intelSourceFilter(src,b){activeIntelSource=src;document.querySelectorAll('.intelligence-source-filter button').forEach(x=>x.classList.remove('active'));if(b)b.classList.add('active');renderIntelligence();}
function clearIntelligenceSearch(){if($('intel_q'))$('intel_q').value='';activeIntelSource='ALL';document.querySelectorAll('.intelligence-source-filter button').forEach((x,i)=>x.classList.toggle('active',i===0));renderIntelligence();}
function intelTokens(q){return normText(q).match(/[a-z0-9.]{2,}/g)?.filter(w=>!manualStop.has(w)&&!peasStop.has(w))||[];}
function intelScore(text,tokens,phrase){const base=normText(text);let score=0;if(!tokens.length&&phrase)return 0;if(phrase&&base.includes(phrase))score+=140;tokens.forEach(tok=>{const safe=tok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const hits=(base.match(new RegExp(safe,'g'))||[]).length;score+=Math.min(hits,12)*8;});return score;}
function intelSourceAllowed(src){return activeIntelSource==='ALL'||activeIntelSource===src;}
function buildExclusionPoolForIntelligence(q){const tokens=intelTokens(q);const phrase=normText(q);return (window.EXCLUSIONES_IAFAS||[]).map(r=>{const text=[r.id,r.tipo,r.grupo,r.iafas,r.resumen,r.regla,r.keywords].join(' ');const score=intelScore(text,tokens,phrase);if(score>0)return {source:'Exclusiones IAFAS',kind:r.tipo,title:r.grupo,subtitle:r.iafas,text:[r.resumen,r.regla].filter(Boolean).join(' '),page:null,score};}).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,20);}
function buildIntelligencePool(q){const tokens=intelTokens(q);const phrase=normText(q);let out=[];
  if(intelSourceAllowed('LISTAS')) data.forEach(r=>{const text=[r['COMPAÑÍA'],r['SUB CIA'],r.ID,r.LISTA,r['TECNOLOGÍA'],r['COBERTURA'],r['CONDICIONES / EXCEPCIONES'],r['PALABRAS CLAVE'],r['REQUIERE CG']].join(' ');const score=intelScore(text,tokens,phrase);if(score>0)out.push({source:'Listas AB',kind:'Cobertura',title:r['TECNOLOGÍA'],subtitle:`${r.ID} · Lista ${r.LISTA} · ${[r['COMPAÑÍA'],r['SUB CIA']].filter(Boolean).join(' · ')}`,text:`${r['COBERTURA']} ${r['CONDICIONES / EXCEPCIONES']}`,page:null,action:()=>{activeFilter='ALL';listasAbHasSearched=true;go('buscador',menuBtn('buscador'));$('q').value=r.ID;render(filtered());},score});});
  if(intelSourceAllowed('MANUAL')) manualRecords.filter(manualAllowedForSearch).forEach(r=>{const text=[manualKind(r),manualTitle(r),manualBody(r),r.keywords].join(' ');const score=intelScore(text,tokens,phrase);if(score>0)out.push({source:'Manual de Normas',kind:manualKind(r),title:manualTitle(r),subtitle:`${manualKind(r)} · p. ${r.page}`,text:manualBody(r),page:r.page,url:'static/docs/manual-normas-facturacion.pdf#page='+r.page,score});});
  if(intelSourceAllowed('PEAS')) filteredPeasForIntelligence(q).forEach(r=>{out.push(r);});
  if(intelSourceAllowed('EXC')) buildExclusionPoolForIntelligence(q).forEach(r=>out.push(r));
  if(intelSourceAllowed('CAP')) capData.forEach(r=>{const text=[r.grupo,r.pregunta,r.tema,r.respuesta,r.resumen,r.accion,r.decision,r.revisar,r.alerta,r.alertas,r.fuente,r.keywords,r.aliases].join(' ');const score=intelScore(text,tokens,phrase);if(score>0)out.push({source:'Capacitaciones IAFAS',kind:r.grupo||'Capacitación',title:r.pregunta||r.tema,subtitle:`${r.fuente||'Capacitación'} · p. ${r.pagina||''}`,text:[r.respuesta||r.resumen,r.accion||r.decision,r.revisar,r.alerta||r.alertas].filter(Boolean).join(' '),page:r.pagelink||r.pagina,score});});
  return out.sort((a,b)=>b.score-a.score).slice(0,60);
}
function filteredPeasForIntelligence(q){const oldType=activePeasType,oldChapter=activePeasChapter;activePeasType='ALL';activePeasChapter='ALL';const results=filteredPeas().slice(0,25).map(r=>({source:'PEAS',kind:peasKindLabel(r.type),title:r.heading,subtitle:`${r.chapter||'PEAS'} · p. ${r.page}`,text:r.type==='COND'?[r.text,(r.cie10||[]).join(' '),`Prestaciones relacionadas: ${(r.related||[]).slice(0,8).map(p=>p.code+' '+p.denomination).join('; ')}`].filter(Boolean).join('\n'):(r.text||''),page:r.page,url:peasPdf(r.page),score:r._score||1}));activePeasType=oldType;activePeasChapter=oldChapter;return results;}
function intelCard(r,i){const open=r.url?`<a href="${r.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Abrir fuente</a>`:'';return `<article class="manual-result intelligence-card" onclick="intelDetail(${i})"><div class="manual-result-head"><span class="badgeA">${esc(r.source)}</span><span class="status rest">${esc(r.kind)}</span><b>${esc(r.title)}</b></div><p>${esc((r.text||'').slice(0,380))}${(r.text||'').length>380?'...':''}</p><div class="manual-result-foot"><span>${esc(r.subtitle||'Fuente documental')}</span>${open}</div></article>`;}
let intelCurrent=[];
function renderIntelligence(){if(!$('intelResults'))return;const q=($('intel_q')?.value||'').trim();if(!q){$('intelCount').innerText='0 resultados';$('intelAnswer').innerHTML='<div class="empty-state">Escribe una consulta para buscar en la biblioteca del Hub.</div>';$('intelResults').innerHTML='';return;}intelCurrent=buildIntelligencePool(q);$('intelCount').innerText=intelCurrent.length+' resultados';if(!intelCurrent.length){$('intelAnswer').innerHTML='<div class="empty-state">No encontré coincidencias. Prueba con menos palabras o con un código como K35, UCI, PEAS, apendicitis, carta de garantía.</div>';$('intelResults').innerHTML='';return;}intelDetail(0);$('intelResults').innerHTML=intelCurrent.map(intelCard).join('');}
function intelDetail(i){const r=intelCurrent[i];if(!r)return;const link=r.url?`<a class="source-link" href="${r.url}" target="_blank" rel="noopener">Abrir fuente</a>`:'';$('intelAnswer').innerHTML=`<div class="manual-answer-top"><div><span>${esc(r.source)} · ${esc(r.kind)}</span><h3>${esc(r.title)}</h3></div>${link}</div><blockquote>${esc(r.text||'')}</blockquote><div class="manual-citation"><b>Fuente:</b> ${esc(r.subtitle||r.source)}</div>`;document.querySelectorAll('.intelligence-card').forEach((x,idx)=>x.classList.toggle('sel',idx===i));}

let guideStep=0;
const GUIDE_SEEN_KEY='panel_ab_guide_seen_v429';
const GUIDE_STEPS=[
  {kicker:'Bienvenida',title:'Empieza por el inicio',text:'El Hub concentra búsquedas, normas, PEAS, listas y fuentes operativas para responder con sustento.',module:'inicio',note:'Ruta recomendada',bullets:['Usa el buscador principal si no sabes en qué módulo está la respuesta.','Los accesos rápidos llevan a Listas AB, Manual de Normas, PEAS y capacitaciones.','La franja de IAFAS muestra qué fuentes están cargadas y cuáles quedan pendientes.'],nav:0,search:'Pregunta por PEAS, UCI, carta de garantía o una prestación.'},
  {kicker:'Chat virtual',title:'Darbot',text:'Chat conversacional para orientar consultas, ubicar fuentes probables, advertir riesgos y proponer validaciones mínimas.',module:'miniia',note:'Cómo leerlo',bullets:['Abre Darbot desde el botón flotante o desde el menú lateral.','Describe el caso con palabras simples: prestación, diagnóstico, cobro, IAFAS o regla.','Darbot descompone el caso, contrasta varias fuentes del Hub y muestra el sustento utilizado antes de concluir.'],nav:1,search:'Ejemplo: cobro de instrumentista según manual.'},
  {kicker:'Coberturas',title:'Listas AB',text:'Permite ubicar prestaciones, estado de cobertura, condiciones, excepciones y si requiere carta de garantía.',module:'buscador',note:'Lectura operativa',bullets:['Busca por ID, tecnología, palabra clave, cobertura o condición.','Selecciona una fila para ver la decisión rápida y las excepciones.','No cierres una respuesta solo con la lista: valida convenio, póliza y vigencia.'],nav:2,search:'Buscar tecnología, palabra clave o ID.'},
  {kicker:'Biblioteca inteligente',title:'Manual de Normas y PEAS',text:'El Manual responde reglas de facturación; PEAS responde condiciones asegurables, CIE-10 y prestaciones relacionadas.',module:'manual',note:'Diferencia clave',bullets:['Manual: cobros, honorarios, UCI, sala, farmacia, alta, auditoría y reglas administrativas.','PEAS: diagnósticos, condiciones asegurables, CIE-10 y prestaciones del plan esencial.','Usa el botón Ver documento o Abrir PDF para validar la página fuente.'],nav:3,search:'Manual: honorarios médicos. PEAS: K35 apendicitis.'},
  {kicker:'Operación',title:'Capacitaciones, central y contactos',text:'Reúne fichas operativas por IAFAS, canales de consulta, emergencias y terminología para el equipo.',module:'capacitaciones',note:'Uso diario',bullets:['Capacitaciones resume requisitos, alertas y fuentes por aseguradora.','Central y contactos quedan preparados para rutas de autorización y consultas críticas.','Glosario ayuda a alinear términos antes de escalar un caso.'],nav:4,search:'Buscar capacitación, contacto, requisito o alerta.'}
];
function guideVisual(step){
  const items=['Inicio','Darbot','Listas','Manual/PEAS','Operación'];
  return `<div class="guide-video"><div class="guide-video-top"><i></i><i></i><i></i></div><div class="guide-video-body"><div class="guide-video-nav">${items.map((x,i)=>`<span class="${i===step.nav?'active':''}" title="${esc(x)}"></span>`).join('')}</div><div class="guide-video-main"><span class="guide-video-line"></span><span class="guide-video-line short"></span><div class="guide-video-search">${esc(step.search)}<b></b></div><div class="guide-video-grid"><span class="guide-video-card"></span><span class="guide-video-card"></span><span class="guide-video-card"></span><span class="guide-video-card"></span></div></div></div><i class="guide-video-cursor"></i></div>`;
}
function setGuideStep(i){
  const step=GUIDE_STEPS[Math.max(0,Math.min(i,GUIDE_STEPS.length-1))]; guideStep=GUIDE_STEPS.indexOf(step);
  if(!$('guideOverlay'))return;
  if($('guideShell'))$('guideShell').classList.remove('welcome-mode');
  $('guideKicker').innerText=step.kicker;$('guideTitle').innerText=step.title;$('guideText').innerText=step.text;$('guideNoteTitle').innerText=step.note;
  $('guideBullets').innerHTML=step.bullets.map(x=>`<li>${esc(x)}</li>`).join('');
  $('guideVisual').innerHTML=guideVisual(step);
  $('guidePrimary').innerText=step.module==='inicio'?'Ir al inicio':'Ir a '+step.title;
  $('guideProgress').style.width=Math.round(((guideStep+1)/GUIDE_STEPS.length)*100)+'%';
  document.querySelectorAll('[data-guide-step]').forEach((b,idx)=>b.classList.toggle('active',idx===guideStep));
  document.querySelectorAll('.guide-filmstrip i').forEach((x,idx)=>x.classList.toggle('active',idx<=guideStep));
}
function showGuideWelcome(){if($('guideShell'))$('guideShell').classList.add('welcome-mode');}
function openGuide(step='welcome'){if(!$('guideOverlay'))return;document.body.classList.add('guide-focus');$('guideOverlay').classList.remove('app-hidden');if(step==='welcome')showGuideWelcome();else setGuideStep(step);}
function startGuide(){setGuideStep(0);}
function closeGuide(markSeen=false){if($('guideOverlay'))$('guideOverlay').classList.add('app-hidden');document.body.classList.remove('guide-focus');if(markSeen)sessionStorage.setItem(GUIDE_SEEN_KEY,'1');}
function nextGuideStep(){if(guideStep<GUIDE_STEPS.length-1)setGuideStep(guideStep+1);else closeGuide(true);}
function guidePrimaryAction(){const step=GUIDE_STEPS[guideStep];closeGuide(true);if(step.module==='miniia'&&typeof openDarwenChat==='function'){openDarwenChat();return;}go(step.module,menuBtn(step.module));}
function maybeOpenGuide(){if(sessionStorage.getItem(GUIDE_SEEN_KEY)==='1')return;setTimeout(()=>openGuide('welcome'),350);}

function userAllowedModules(user){return user.allowed?.includes('*')?['*']:(user.allowed||[]).filter(id=>MODULES[id]);}
function userDisplayName(name,user){return user?.displayName||sessionUser?.displayName||name;}
function permissionLabel(id){return MODULES[id]?.name||id;}
function renderPermissionEditor(selected=userModulesForRole($('adminRole')?.value||'Consulta rápida')){
  if(!$('adminPermissions'))return;
  const allSelected=selected.includes('*');
  const targetName=normalizeUserName($('adminUserName')?.value||editingUser||'');
  $('adminPermissions').innerHTML=Object.entries(MODULES).filter(([id])=>id!=='lista'&&id!=='retrospectiva').map(([id,mod])=>{
    const reserved=ADMIN_ONLY_MODULES.includes(id);
    const checked=reserved?targetName==='dcolan':(allSelected||selected.includes(id));
    const disabled=reserved?'disabled':'';
    const hint=reserved?'<small>Reservado para dcolan</small>':`<small>${esc(mod.group)}</small>`;
    return `<label class="permission-item"><input type="checkbox" value="${esc(id)}" ${checked?'checked':''} ${disabled}><span><b>${esc(mod.name)}</b>${hint}</span></label>`;
  }).join('');
}
function syncRolePermissions(){const role=$('adminRole')?.value||'Consulta rápida';renderPermissionEditor(userModulesForRole(role));}
function resetUserForm(){
  editingUser=null;
  if($('userFormTitle'))$('userFormTitle').innerText='Nuevo usuario';
  if($('adminSubmitBtn'))$('adminSubmitBtn').innerText='Crear usuario';
  if($('adminUserName')){$('adminUserName').value='';$('adminUserName').disabled=false;}
  if($('adminDisplayName'))$('adminDisplayName').value='';
  if($('adminPassword'))$('adminPassword').value='';
  if($('adminRole'))$('adminRole').value='Consulta rápida';
  if($('adminActive'))$('adminActive').checked=true;
  if($('userFormMessage'))$('userFormMessage').innerText='';
  renderPermissionEditor(userModulesForRole('Consulta rápida'));
}
function selectedPermissions(){
  return [...document.querySelectorAll('#adminPermissions input:checked')].map(x=>x.value);
}
function saveUserFromForm(event){
  event.preventDefault();
  const name=normalizeUserName($('adminUserName')?.value);
  const pass=$('adminPassword')?.value||'';
  const wasEditing=!!editingUser;
  if(!name){alert('Ingresa un usuario válido.');return;}
  if(!editingUser&&!pass){alert('Ingresa una contraseña para el nuevo usuario.');return;}
  if(DEFAULT_USERS[name]&&editingUser!==name){alert('Los usuarios base no pueden duplicarse.');return;}
  const existing=USERS[name]||{};
  const allowed=selectedPermissions().filter(id=>name==='dcolan'||!ADMIN_ONLY_MODULES.includes(id));
  USERS[name]={...existing,password:pass||existing.password,role:$('adminRole').value,allowed,active:!!$('adminActive').checked,displayName:($('adminDisplayName').value||name).trim(),createdAt:existing.createdAt||new Date().toLocaleDateString('es-PE')};
  saveUsers();
  renderUsersAdmin();
  if(sessionUser?.name===name){
    sessionUser={name,role:USERS[name].role,allowed:USERS[name].allowed,displayName:USERS[name].displayName};
    sessionStorage.setItem('panel_ab_user',JSON.stringify(sessionUser));
    if($('userName'))$('userName').innerText=USERS[name].displayName||name;
  }
  resetUserForm();
  if($('userFormMessage'))$('userFormMessage').innerText=wasEditing?'Usuario actualizado correctamente.':'Usuario creado correctamente.';
}
function editUser(name){
  const user=USERS[name];if(!user)return;
  editingUser=name;
  $('userFormTitle').innerText='Editar usuario';
  if($('adminSubmitBtn'))$('adminSubmitBtn').innerText='Actualizar usuario';
  $('adminUserName').value=name;$('adminUserName').disabled=true;
  $('adminDisplayName').value=user.displayName||name;
  $('adminPassword').value='';
  $('adminRole').value=user.role||'Consulta rápida';
  $('adminActive').checked=user.active!==false;
  renderPermissionEditor(user.allowed||userModulesForRole(user.role));
  if($('userFormMessage'))$('userFormMessage').innerText='Deja la contraseña vacía si no deseas cambiarla.';
}
function toggleUserActive(name){
  if(DEFAULT_USERS[name]){alert('Los usuarios base deben permanecer activos.');return;}
  USERS[name].active=USERS[name].active===false;
  saveUsers();renderUsersAdmin();
}
function deleteUser(name){
  if(DEFAULT_USERS[name]){alert('Los usuarios base no se eliminan.');return;}
  if(sessionUser?.name===name){alert('No puedes eliminar el usuario con el que estás conectado.');return;}
  if(confirm('¿Eliminar este usuario del portal?')){delete USERS[name];saveUsers();renderUsersAdmin();resetUserForm();}
}
function renderUsersAdmin(){
  if(!$('usersTable'))return;
  const names=Object.keys(USERS).sort((a,b)=>a.localeCompare(b));
  $('userCount').innerText=names.length+' usuarios';
  $('usersTable').innerHTML=names.map(name=>{const u=USERS[name];const perms=userAllowedModules(u);const labels=perms.includes('*')?'Todos los módulos':perms.map(permissionLabel).join(', ');const state=u.active===false?'Inactivo':'Activo';return `<tr><td><div class="tech">${esc(userDisplayName(name,u))}</div><div class="sub">${esc(name)}${DEFAULT_USERS[name]?' · usuario base':''}</div></td><td><span class="status rest">${esc(u.role||'Consulta rápida')}</span></td><td><span class="status ${u.active===false?'no':'ok'}">${state}</span></td><td><div class="sub">${esc(labels)}</div></td><td><div class="user-actions"><button onclick="editUser('${esc(name)}')">Editar</button><button onclick="toggleUserActive('${esc(name)}')">${u.active===false?'Activar':'Desactivar'}</button><button onclick="deleteUser('${esc(name)}')">Eliminar</button></div></td></tr>`;}).join('');
  if(!$('adminPermissions')?.children.length)resetUserForm();
}
function applyAccess(){const isAdmin=ADMIN_ONLY_MODULES.some(canPage);document.body.classList.toggle('limited-role',!isAdmin);document.querySelectorAll('[data-admin-only]').forEach(el=>{el.hidden=!isAdmin;});if($('userName'))$('userName').innerText=userDisplayName(sessionUser.name,USERS[sessionUser.name]||sessionUser);document.querySelectorAll('[data-module]').forEach(el=>{const mod=el.getAttribute('data-module');el.hidden=!canPage(mod);});if(!isAdmin){document.querySelectorAll('[data-module="usuarios"], [data-module="fuentes"], #usuarios, #fuentes').forEach(el=>{el.hidden=true;});}document.querySelectorAll('.menu-group-label').forEach(label=>{let n=label.nextElementSibling,visible=false;while(n && !n.classList?.contains('menu-group-label')){if(n.matches?.('[data-module]')&&!n.hidden)visible=true;n=n.nextElementSibling;}label.hidden=!visible;});document.querySelectorAll('.menu button').forEach(x=>x.classList.remove('active'));const first=menuBtn('inicio')||document.querySelector('.menu button:not([hidden])');if(first)first.classList.add('active');document.querySelectorAll('.page').forEach(x=>x.classList.remove('show'));$('inicio').classList.add('show');renderUsersAdmin();}
function login(event){event.preventDefault();const name=normalizeUserName($('loginUser').value);const pass=$('loginPass').value;USERS=loadUsers();let user=USERS[name];if(DEFAULT_USERS[name]&&pass===DEFAULT_USERS[name].password){user={...DEFAULT_USERS[name]};USERS[name]={...user};saveUsers();}if(!user||user.password!==pass){alert('Usuario o contraseña incorrectos. Usa dcolan/dcolan o ctejada/ctejada.');return;}if(user.active===false){alert('Este usuario está inactivo. Solicita activación al administrador del portal.');return;}sessionUser={name,role:user.role,allowed:user.allowed,displayName:user.displayName||name};sessionStorage.setItem('panel_ab_user',JSON.stringify(sessionUser));sessionStorage.removeItem(GUIDE_SEEN_KEY);$('loginScreen').classList.add('app-hidden');$('appLayout').classList.remove('app-hidden');applyAccess();init();setTimeout(()=>openGuide('welcome'),120);}
function logout(){sessionStorage.removeItem('panel_ab_user');sessionUser=null;document.body.classList.remove('limited-role');$('appLayout').classList.add('app-hidden');$('loginScreen').classList.remove('app-hidden');$('loginPass').value='';}
function restoreSession(){const raw=sessionStorage.getItem('panel_ab_user');if(!raw)return;try{USERS=loadUsers();const saved=JSON.parse(raw);const user=USERS[saved.name];if(user&&user.active!==false){sessionUser={name:saved.name,role:user.role,allowed:user.allowed,displayName:user.displayName||saved.displayName||saved.name};$('loginScreen').classList.add('app-hidden');$('appLayout').classList.remove('app-hidden');applyAccess();init();setTimeout(()=>openGuide('welcome'),120);}}catch(_e){}}
$('loginForm').addEventListener('submit',login);
applyTheme();
restoreSession();
syncVersion();
syncCloudPublishedSources();


/* v4.2.66 · Administración modular · API local independiente */
function hubIsNetlifyCloud(){return location.protocol.startsWith('http')&&!['localhost','127.0.0.1'].includes(location.hostname);}
function cloudSourceAction(path){return ({'/api/sources':'sources','/api/source/preview':'preview','/api/source/publish':'publish','/api/source/restore':'restore'})[path]||'';}
async function sourceHubApi(path, options={}){
  if(typeof window.hubApi==='function')return window.hubApi(path, options);
  const headers={'Content-Type':'application/json', ...(options.headers||{})};
  const token=sessionStorage.getItem('iafas_hub_api_token_v1');
  if(token)headers['X-Session-Token']=token;
  let target=path;
  if(hubIsNetlifyCloud()){
    const action=cloudSourceAction(path);
    if(!action)throw new Error('Esta operación no está habilitada en la publicación web.');
    target='/.netlify/functions/source-center?action='+encodeURIComponent(action);
  }
  let res;
  try{res=await fetch(target,{...options,headers,cache:'no-store'});}catch(_err){throw new Error(hubIsNetlifyCloud()?'No se pudo conectar con el Centro de Fuentes publicado en Netlify. La base LISTAS AB del despliegue sigue disponible.':'No se pudo conectar con el servidor local del Hub. Mantén abierta la ventana CMD e intenta nuevamente.');}
  const raw=await res.text();
  let payload=null;
  try{payload=raw?JSON.parse(raw):{};}catch(_e){payload={ok:false,error:`Respuesta no válida del servidor (HTTP ${res.status}). ${raw.slice(0,180)}`};}
  if(!res.ok||payload.ok===false){if(res.status===401||res.status===403)throw new Error('La sesión de administrador no está disponible. Cierra sesión, vuelve a ingresar y repite la carga.');throw new Error(payload.error||`No se pudo completar la operación (HTTP ${res.status}).`);}
  return payload;
}
async function syncCloudPublishedSources(){
  if(!hubIsNetlifyCloud())return;
  try{
    const r=await fetch('/.netlify/functions/source-center?action=data&type=listas_ab',{cache:'no-store'});
    const j=await r.json();
    if(j?.ok&&j.payload?.records?.length){data=j.payload.records;window.LISTAS_AB_DATA=data;window.DATA_UPDATE_STATUS={...(window.DATA_UPDATE_STATUS||{}),fecha:j.payload.published_at||'',archivo:j.payload.filename||'LISTAS AB',registros:data.length,companias:Object.fromEntries([...new Set(data.map(x=>x['COMPAÑÍA']).filter(Boolean))].map(c=>[c,data.filter(x=>x['COMPAÑÍA']===c).length]))};if(sessionUser)init();}
  }catch(_e){}
  try{
    const r=await fetch('/.netlify/functions/source-center?action=data&type=capacitaciones_master',{cache:'no-store'});
    const j=await r.json();
    if(j?.ok&&j.payload?.records?.length){window.CAPACITACIONES_MAESTRO=j.payload.records;if(sessionUser)renderCapacitaciones();}
  }catch(_e){}
}

/* v4.2.64 · Centro de Fuentes */
let sourcePendingPreview=null;
function sourceFmtBytes(n){n=Number(n||0);if(n<1024)return n+' B';if(n<1024*1024)return (n/1024).toFixed(1)+' KB';return (n/1024/1024).toFixed(1)+' MB';}
function sourceFmtDate(v){if(!v)return '-';try{return new Date(v).toLocaleString('es-PE',{dateStyle:'short',timeStyle:'short'});}catch(_){return String(v);}}
function sourceDrag(e,on){e.preventDefault();e.stopPropagation();document.getElementById('sourceDropzone')?.classList.toggle('dragging',!!on);}
function sourceDrop(e){sourceDrag(e,false);const file=e.dataTransfer?.files?.[0];if(file)sourceFileSelected(file);}
function sourceReadBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.onerror=()=>reject(new Error('No se pudo leer el archivo.'));r.readAsDataURL(file);});}
function sourceTypeLabel(t){return ({listas_ab:'LISTAS AB',capacitaciones_master:'Maestro de Capacitaciones IAFAS',peas:'PEAS',manual:'Manual de Normas',capacitacion:'Capacitación / documento IAFA'})[t]||t;}
async function sourceFileSelected(file){
  if(!file)return;
  const msg=$('sourceUploadMessage'),preview=$('sourcePreview');
  if(preview)preview.classList.add('app-hidden');sourcePendingPreview=null;
  if(msg)msg.innerText=`Procesando ${file.name}... El nombre del archivo no necesita ser LISTAS-AB-ACTUALIZADO.xlsx.`;
  try{
    const content=await sourceReadBase64(file);
    const result=await sourceHubApi('/api/source/preview',{method:'POST',body:JSON.stringify({filename:file.name,type:$('sourceType')?.value||'auto',content})});
    sourcePendingPreview=result.preview;
    renderSourcePreview(result.preview);
    if(msg)msg.innerText='Vista previa lista. Revisa antes de publicar.';
  }catch(err){if(msg)msg.innerText=err.message||'No se pudo procesar el archivo.';}
}
function renderSourcePreview(p){
  const host=$('sourcePreview');if(!host||!p)return;
  const d=p.detail||{},cur=p.current||{};
  const currentText=p.type==='capacitacion'?`${cur.documents||0} documentos publicados`:p.type==='capacitaciones_master'?`${cur.records||0} contenidos · ${cur.companies||0} entidades`:(cur.name?`${cur.name} · ${sourceFmtBytes(cur.bytes)}`:'Sin fuente vigente registrada');
  let detail='';
  if(p.type==='listas_ab'){
    detail=`<div><span>Registros válidos</span><b>${d.records||0}</b></div><div><span>IAFAS detectadas</span><b>${Object.keys(d.companies||{}).length}</b></div>`;
  }else if(p.type==='capacitaciones_master'){
    detail=`<div><span>Contenidos publicables</span><b>${d.records||0}</b></div><div><span>IAFAS / entidades</span><b>${Object.keys(d.companies||{}).length}</b></div><div><span>Detalle documental</span><b>${d.detail_rows||0}</b></div><div><span>Registros curados</span><b>${d.curated_rows||0}</b></div><div><span>Omitidos por estado/acción</span><b>${d.skipped||0}</b></div>`;
  }else{
    detail=`<div><span>Páginas</span><b>${d.pages||0}</b></div><div><span>Texto extraíble</span><b>${d.text_extractable?'Sí':'No'}</b></div><div><span>Índice / marcadores</span><b>${d.outline_items||0}</b></div>`;
  }
  const warning=d.warning?`<div class="source-warning">⚠ ${esc(d.warning)}</div>`:'';
  host.innerHTML=`<div class="source-preview-head"><div><span>VISTA PREVIA · NO PUBLICADO</span><h3>${esc(p.label)}</h3><p>${esc(p.filename)} · ${sourceFmtBytes(p.bytes)}</p></div><span class="status rest">Pendiente de aprobación</span></div><div class="source-preview-grid"><div><span>Fuente actual</span><b>${esc(currentText)}</b></div>${detail}</div>${warning}<div class="source-safety-note">La versión vigente no se modificará hasta que presiones <b>Publicar actualización</b>. Si el proceso falla, se conserva la fuente anterior.</div><div class="source-preview-actions"><button class="pill action-pill" onclick="cancelSourcePreview()">Cancelar</button><button class="pill blue action-pill" onclick="publishSourcePreview()">Publicar actualización</button></div>`;
  host.classList.remove('app-hidden');
}
function cancelSourcePreview(){sourcePendingPreview=null;if($('sourcePreview')){$('sourcePreview').classList.add('app-hidden');$('sourcePreview').innerHTML='';}if($('sourceFileInput'))$('sourceFileInput').value='';if($('sourceUploadMessage'))$('sourceUploadMessage').innerText='Selecciona un archivo para generar la vista previa.';}
async function publishSourcePreview(){
  const p=sourcePendingPreview;if(!p)return;
  const msg=$('sourceUploadMessage');
  if(!confirm(`¿Publicar ${sourceTypeLabel(p.type)} usando ${p.filename}?\n\nSe creará respaldo de la versión vigente antes del cambio.`))return;
  if(msg)msg.innerText='Publicando y reconstruyendo el índice...';
  try{
    const result=await sourceHubApi('/api/source/publish',{method:'POST',body:JSON.stringify({upload_id:p.upload_id,type:p.type,title:$('sourceTitle')?.value||'',company:$('sourceCompany')?.value||'',version:$('sourceVersion')?.value||'',valid_from:$('sourceValidFrom')?.value||'',notes:$('sourceNotes')?.value||''})});
    if(msg)msg.innerText='Publicación completada. Recargando el Hub con la nueva fuente...';
    sourcePendingPreview=null;
    setTimeout(()=>location.reload(),1100);
  }catch(err){if(msg)msg.innerText=err.message||'No se pudo publicar. La fuente vigente se conservó.';}
}
function sourceCard(s){
  const c=s.current||{};let main='Sin publicación desde el Centro';let sub='Disponible para recibir una fuente';
  if(s.type==='capacitacion'){main=`${c.documents||0} documentos publicados`;sub=c.latest?`Último: ${c.latest.filename||c.latest.title||'-'}`:'Puedes agregar múltiples documentos';}
  else if(s.type==='capacitaciones_master'){main=`${c.records||0} contenidos · ${c.companies||0} entidades`;sub=c.modified?`Última actualización: ${sourceFmtDate(c.modified)}`:'Sube el Excel maestro para publicar';}
  else if(c.name||c.filename){main=c.title||c.filename||c.name;sub=[c.version,c.published_at?sourceFmtDate(c.published_at):c.modified?sourceFmtDate(c.modified):''].filter(Boolean).join(' · ');}
  return `<article class="source-status-card"><div class="source-status-top"><span>${esc(s.label)}</span><i class="source-dot"></i></div><b>${esc(main)}</b><p>${esc(sub||'Fuente vigente')}</p><button onclick="sourcePrepareType('${esc(s.type)}')">Actualizar</button></article>`;
}
function sourcePrepareType(type){if($('sourceType'))$('sourceType').value=type;$('sourceDropzone')?.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>$('sourceFileInput')?.click(),250);}
async function loadSourceCenter(){
  if(!$('sourceCards'))return;
  try{
    const result=await sourceHubApi('/api/sources');
    $('sourceCards').innerHTML=(result.sources||[]).map(sourceCard).join('');
    const history=result.history||[];
    $('sourceHistory').innerHTML=history.length?history.map(h=>`<tr><td>${esc(sourceFmtDate(h.published_at))}</td><td><b>${esc(h.label||sourceTypeLabel(h.type))}</b></td><td>${esc(h.filename||'-')}</td><td>${esc(h.version||'-')}</td><td><div class="source-history-action"><span class="status ${h.status==='restored'?'rest':'ok'}">${h.status==='restored'?'Restaurado':'Publicado'}</span>${h.type!=='capacitacion'&&h.backup?`<button onclick="restoreSourceVersion('${esc(h.id)}','${esc(h.label||sourceTypeLabel(h.type))}')">Restaurar anterior</button>`:''}</div></td></tr>`).join(''):'<tr><td colspan="5"><div class="empty-state">Aún no hay publicaciones realizadas desde el Centro de Fuentes.</div></td></tr>';
    if($('sourceSyncState'))$('sourceSyncState').innerText='Fuentes listas · '+(result.sources||[]).length;
  }catch(err){
    if($('sourceSyncState'))$('sourceSyncState').innerText='Base publicada disponible';
    if($('sourceCards'))$('sourceCards').innerHTML=`<article class="source-status-card"><div class="source-status-top"><span>LISTAS AB</span><i class="source-dot"></i></div><b>${data.length||0} registros cargados</b><p>Fuente base: LISTAS-AB-ACTUALIZADO.xlsx. Para una actualización global, reemplaza ese archivo en GitHub; Netlify reconstruirá los datos automáticamente.</p><button onclick="sourcePrepareType('listas_ab')">Probar carga manual</button></article><div class="empty-state">Centro de publicación avanzada no disponible: ${esc(err.message||'sin respuesta')}. Esto no afecta la base LISTAS AB publicada.</div>`;
  }
}


async function restoreSourceVersion(eventId,label){
  if(!confirm(`¿Restaurar la versión anterior de ${label}?\n\nEl estado actual se respaldará antes de restaurar.`))return;
  try{
    if($('sourceUploadMessage'))$('sourceUploadMessage').innerText='Restaurando versión anterior...';
    await sourceHubApi('/api/source/restore',{method:'POST',body:JSON.stringify({event_id:eventId})});
    if($('sourceUploadMessage'))$('sourceUploadMessage').innerText='Versión restaurada. Recargando...';
    setTimeout(()=>location.reload(),900);
  }catch(err){alert(err.message||'No se pudo restaurar la versión.');}
}

// Include newly uploaded training-document pages in the shared source pool without forcing a Q&A schema.
const _buildIntelligencePool=buildIntelligencePool;
buildIntelligencePool=function(q){
  const base=_buildIntelligencePool(q);const tokens=intelTokens(q),phrase=normText(q);let extra=[];
  if(intelSourceAllowed('CAP'))(window.CAPACITACIONES_DOCUMENTOS||[]).forEach(doc=>{(doc.pages||[]).forEach(pg=>{const text=[doc.title,doc.company,doc.version,doc.notes,pg.heading,pg.text].join(' ');const score=intelScore(text,tokens,phrase);if(score>0)extra.push({source:'Capacitaciones IAFAS',kind:doc.company||'Documento',title:pg.heading||doc.title,subtitle:`${doc.title||'Documento'} · p. ${pg.page}`,text:pg.text,page:pg.page,url:(doc.pdf||'')+'#page='+pg.page,score});});});
  return base.concat(extra).sort((a,b)=>b.score-a.score).slice(0,60);
};

// v4.2.69 - Capacitaciones redisenadas: Por IAFA / Conceptos / Casos
let cap69Mode='';
let cap69Filter='ALL';
let cap69Rows=[];
const cap69ConceptIds=['QA-001','QA-002','QA-003','QA-005','QA-012','QA-015'];
const cap69CaseIds=['QA-001','QA-004','QA-005','QA-009','QA-012'];
function cap69Pdf(r){
  if(r&&Object.prototype.hasOwnProperty.call(r,'pdf')) return r.pdf||'';
  if((r?.grupo||'').toUpperCase()==='RIMAC'||/rimac/i.test([r?.pregunta,r?.fuente,r?.keywords].join(' '))) return 'static/docs/rimac/rimac-preguntas-frecuentes-2025.pdf';
  return 'static/docs/capacitacion-lineamientos-convenios-2026.pdf';
}
function cap69Iafa(r){
  const t=capNorm([r?.grupo,r?.pregunta,r?.fuente,r?.keywords].join(' '));
  if(t.includes('rimac')) return 'Rímac';
  if(t.includes('pacifico')) return 'Pacífico';
  if(t.includes('mapfre')) return 'Mapfre';
  if(t.includes('sanitas')) return 'Sanitas';
  if(t.includes('positiva')) return 'La Positiva';
  return 'General';
}
function cap69Open(mode){
  cap69Mode=mode;cap69Filter='ALL';
  $('cap69Home').hidden=true;$('cap69Workspace').hidden=false;
  const map={
    iafa:['Por IAFA','Capacitaciones por IAFA','Solo se muestran aseguradoras con información realmente cargada en el Hub.'],
    conceptos:['Conceptos clave','Conceptos clave','Definiciones esenciales y qué validar antes de responder.'],
    casos:['Casos prácticos','Casos prácticos','Situaciones frecuentes para practicar la decisión operativa.']
  };
  const m=map[mode];$('cap69Eyebrow').innerText=m[0];$('cap69WorkspaceTitle').innerText=m[1];$('cap69WorkspaceDesc').innerText=m[2];
  cap69Render();
}
function cap69Back(){$('cap69Workspace').hidden=true;$('cap69Home').hidden=false;cap69Mode='';}
function cap69BaseRows(){
  if(cap69Mode==='conceptos') return cap69ConceptIds.map(id=>capData.find(x=>x.id===id)).filter(Boolean);
  if(cap69Mode==='casos') return cap69CaseIds.map(id=>capData.find(x=>x.id===id)).filter(Boolean);
  return capData.slice();
}
function cap69Render(){
  const rows=cap69BaseRows();
  if($('cap69SourceStatus')) $('cap69SourceStatus').innerText=`${capData.length} contenidos disponibles`;
  let filters=[];
  if(cap69Mode==='iafa') filters=['ALL',...new Set(rows.map(cap69Iafa))];
  else if(cap69Mode==='conceptos') filters=['ALL',...new Set(rows.map(r=>r.grupo))];
  else filters=['ALL',...new Set(rows.map(r=>r.grupo))];
  $('cap69Filters').innerHTML=filters.map(f=>`<button class="cap69-filter${cap69Filter===f?' active':''}" onclick="cap69SetFilter('${String(f).replace(/'/g,"\\'")}')">${f==='ALL'?'Todo':esc(f)}</button>`).join('');
  cap69Rows=rows.filter(r=>cap69Filter==='ALL'||(cap69Mode==='iafa'?cap69Iafa(r)===cap69Filter:r.grupo===cap69Filter));
  if(!cap69Rows.length){$('cap69List').innerHTML='<div class="cap69-placeholder">Todavía no hay contenido cargado para esta selección. Cuando se incorpore una nueva fuente desde Gestión de fuentes, aparecerá aquí.</div>';$('cap69Detail').innerHTML='<div class="cap69-empty-detail"><span>Sin contenido disponible</span><p>No se mostrará información inventada o no sustentada.</p></div>';return;}
  $('cap69List').innerHTML=cap69Rows.map((r,i)=>`<button class="cap69-item" onclick="cap69Detail(${i},this)"><div><small>${esc(cap69Mode==='iafa'?cap69Iafa(r):r.grupo)}</small><strong>${esc(r.pregunta||r.tema||'Contenido de capacitación')}</strong></div><span class="meta">p. ${esc(r.pagina||'-')} →</span></button>`).join('');
  cap69Detail(0,$('cap69List').querySelector('.cap69-item'));
}
function cap69SetFilter(f){cap69Filter=f;cap69Render();}
function cap69Detail(i,btn){
  document.querySelectorAll('#cap69List .cap69-item').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');
  const r=cap69Rows[i];if(!r)return;
  const pdf=cap69Pdf(r);const page=r.pagelink||String(r.pagina||'').split(' ')[0];
  const source=[r.fuente,r.pagina?`p. ${r.pagina}`:''].filter(Boolean).join(' · ');
  const mainLabel=cap69Mode==='casos'?'Caso':'Definición';
  $('cap69Detail').innerHTML=`<div class="cap69-detail-head"><small>${esc(cap69Mode==='iafa'?cap69Iafa(r):r.grupo)}</small><h4>${esc(r.pregunta||r.tema||'Capacitación')}</h4><span class="cap69-badge">${esc(cap69Mode==='casos'?'Práctica guiada':'Fuente sustentada')}</span></div><div class="cap69-detail-body"><div class="cap69-block"><b>${mainLabel}</b><p>${esc(r.respuesta||r.resumen||'-')}</p></div><div class="cap69-block"><b>Qué hacer</b><p>${esc(r.accion||r.decision||'Revisar la fuente vigente antes de concluir.')}</p></div><div class="cap69-block"><b>Qué validar</b><p>${esc(r.revisar||'-')}</p></div><div class="cap69-block"><b>Atención</b><p>${esc(r.alerta||r.alertas||'-')}</p></div><div class="cap69-block cap69-source-row"><div><b>Fuente</b><p>${esc(source||'Fuente no identificada')}</p></div>${pdf?`<a class="cap69-source-link" href="${esc(pdf)}#page=${esc(page)}" target="_blank" rel="noopener">Abrir PDF</a>`:''}</div></div>`;
}
// Override de la antigua renderizacion: la nueva vista usa navegación progresiva.
renderCapacitaciones=function(){if($('cap69Home')&&$('cap69Workspace')&&cap69Mode)cap69Render();if($('cap69SourceStatus'))$('cap69SourceStatus').innerText=`${capData.length} contenidos disponibles`;};


// v4.2.70 - Capacitaciones: búsqueda unificada por pregunta o palabra clave
let cap70Iafa='ALL';
let cap70Topic='ALL';
let cap70Rows=[];
function cap70Norm(v){return capNorm(String(v||''));}
function cap70IafaName(r){
  const explicit=(r?.iafas||r?.iafa||'').trim();
  if(explicit && !/^institucional$/i.test(explicit)) return explicit.replace(/^rimac$/i,'Rímac').replace(/^pacifico$/i,'Pacífico');
  const t=cap70Norm([r?.grupo,r?.pregunta,r?.tema,r?.fuente,r?.keywords,r?.aliases].join(' '));
  if(t.includes('rimac')) return 'Rímac'; if(t.includes('pacifico')) return 'Pacífico'; if(t.includes('mapfre')) return 'Mapfre'; if(t.includes('sanitas')) return 'Sanitas'; if(t.includes('positiva')) return 'La Positiva';
  return 'General';
}
function cap70TopicName(r){return r?.grupo||r?.categoria||'General';}
function cap70SearchText(r){return [r?.pregunta,r?.tema,r?.respuesta,r?.resumen,r?.accion,r?.decision,r?.revisar,r?.alerta,r?.alertas,r?.keywords,r?.aliases,r?.fuente,r?.grupo,r?.categoria,r?.iafas,r?.iafa].filter(Boolean).join(' ');}
function cap70Score(r,q){
  const nq=cap70Norm(q); if(!nq) return 1;
  const text=cap70Norm(cap70SearchText(r)); const title=cap70Norm(r?.pregunta||r?.tema||''); const kw=cap70Norm([r?.keywords,r?.aliases].join(' '));
  let score=0; if(title.includes(nq))score+=80; if(kw.includes(nq))score+=45; if(text.includes(nq))score+=30;
  const toks=nq.split(/\s+/).filter(x=>x.length>1); toks.forEach(t=>{if(title.includes(t))score+=9;if(kw.includes(t))score+=6;if(text.includes(t))score+=3;});
  return score;
}
function cap70BuildFilters(){
  const iafas=['ALL',...new Set(capData.map(cap70IafaName))];
  const topics=['ALL',...new Set(capData.map(cap70TopicName))].slice(0,9);
  if($('cap70IafaFilters')) $('cap70IafaFilters').innerHTML=iafas.map(x=>`<button class="${cap70Iafa===x?'active':''}" onclick="cap70SetIafa('${String(x).replace(/'/g,"\\'")}')">${x==='ALL'?'Todas las IAFAS':esc(x)}</button>`).join('');
  if($('cap70TopicFilters')) $('cap70TopicFilters').innerHTML=topics.map(x=>`<button class="${cap70Topic===x?'active':''}" onclick="cap70SetTopic('${String(x).replace(/'/g,"\\'")}')">${x==='ALL'?'Todos los temas':esc(x)}</button>`).join('');
}
function cap70BuildQuick(){
  const preferred=['emergencia accidental','SITEDS','carencia','carta de garantía','tiempo de espera','postoperatorio'];
  if($('cap70Quick')) $('cap70Quick').innerHTML=preferred.map(q=>`<button onclick="cap70QuickQuery('${q}')">${esc(q.replace(/\b\w/g,m=>m.toUpperCase()))}</button>`).join('');
}
function cap70QuickQuery(q){if($('cap70Query'))$('cap70Query').value=q;cap70Search(true);}
function cap70SetIafa(v){cap70Iafa=v;cap70BuildFilters();cap70Search();}
function cap70SetTopic(v){cap70Topic=v;cap70BuildFilters();cap70Search();}
function cap70Clear(){if($('cap70Query'))$('cap70Query').value='';cap70Iafa='ALL';cap70Topic='ALL';cap70BuildFilters();cap70Rows=[];if($('cap70Results'))$('cap70Results').innerHTML='<div class="cap70-empty"><b>Todo en una sola consulta</b><p>Escribe una pregunta o usa una consulta frecuente para encontrar la respuesta y su sustento.</p></div>';if($('cap70Count'))$('cap70Count').innerText='0 resultados';if($('cap70Hint'))$('cap70Hint').innerText='Empieza escribiendo una pregunta o usa una consulta frecuente.';if($('cap70Detail'))$('cap70Detail').innerHTML='<div class="cap70-empty-detail"><span>Selecciona un resultado</span><p>La respuesta completa aparecerá aquí, con sus validaciones y fuente.</p></div>';}
function cap70Search(force){
  if(!$('cap70Results'))return;
  const q=($('cap70Query')?.value||'').trim();
  let rows=capData.map(r=>({r,score:cap70Score(r,q)})).filter(x=>x.score>0);
  if(cap70Iafa!=='ALL') rows=rows.filter(x=>cap70IafaName(x.r)===cap70Iafa);
  if(cap70Topic!=='ALL') rows=rows.filter(x=>cap70TopicName(x.r)===cap70Topic);
  rows.sort((a,b)=>b.score-a.score); cap70Rows=rows.slice(0,40).map(x=>x.r);
  if($('cap70SourceStatus'))$('cap70SourceStatus').innerText=`${capData.length} contenidos disponibles`;
  if($('cap70Count'))$('cap70Count').innerText=`${cap70Rows.length} resultado${cap70Rows.length===1?'':'s'}`;
  if($('cap70Hint'))$('cap70Hint').innerText=q?`Coincidencias para “${q}”. Selecciona una para ver todo el detalle.`:'Filtra por IAFA o tema, o escribe una consulta.';
  if(!q && cap70Iafa==='ALL' && cap70Topic==='ALL'){cap70Clear();return;}
  if(!cap70Rows.length){$('cap70Results').innerHTML='<div class="cap70-empty"><b>No encontré coincidencias</b><p>Prueba con otra palabra, una pregunta más corta o elimina algún filtro.</p></div>';$('cap70Detail').innerHTML='<div class="cap70-empty-detail"><span>Sin coincidencias</span><p>No se mostrará contenido no sustentado.</p></div>';return;}
  $('cap70Results').innerHTML=cap70Rows.map((r,i)=>`<button class="cap70-result" onclick="cap70Show(${i},this)"><div><div class="cap70-result-top"><span class="cap70-result-tag">${esc(cap70IafaName(r))}</span><span class="cap70-result-tag">${esc(cap70TopicName(r))}</span></div><strong>${esc(r.pregunta||r.tema||'Contenido de capacitación')}</strong><p>${esc(r.respuesta||r.resumen||r.decision||'')}</p></div><span class="cap70-page">p. ${esc(r.pagelink||r.pagina||'-')} →</span></button>`).join('');
  cap70Show(0,$('cap70Results').querySelector('.cap70-result'));
}
function cap70Show(i,btn){
  document.querySelectorAll('#cap70Results .cap70-result').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');
  const r=cap70Rows[i];if(!r)return;
  const pdf=(typeof cap69Pdf==='function'?cap69Pdf(r):(r.pdf||'')); const page=r.pagelink||String(r.pagina||'').split(' ')[0]||1;
  const source=[r.fuente,r.pagina?`p. ${r.pagina}`:''].filter(Boolean).join(' · ');
  $('cap70Detail').innerHTML=`<div class="cap70-detail-head"><div class="cap70-detail-meta"><span>${esc(cap70IafaName(r))}</span><span>${esc(cap70TopicName(r))}</span></div><h3>${esc(r.pregunta||r.tema||'Capacitación')}</h3></div><div class="cap70-block"><b>Respuesta</b><p>${esc(r.respuesta||r.resumen||'-')}</p></div><div class="cap70-block"><b>Qué hacer</b><p>${esc(r.accion||r.decision||'Revisar la fuente vigente antes de concluir.')}</p></div><div class="cap70-block"><b>Qué validar</b><p>${esc(r.revisar||'-')}</p></div><div class="cap70-block cap70-attention"><b>Atención</b><p>${esc(r.alerta||r.alertas||'-')}</p></div><div class="cap70-block cap70-source"><div><b>Fuente</b><p>${esc(source||'Fuente no identificada')}</p></div>${pdf?`<a href="${esc(pdf)}#page=${esc(page)}" target="_blank" rel="noopener">Abrir fuente</a>`:''}</div>`;
}
renderCapacitaciones=function(){if(!$('cap70Query'))return;if($('cap70SourceStatus'))$('cap70SourceStatus').innerText=`${capData.length} contenidos disponibles`;cap70BuildQuick();cap70BuildFilters();};

/* v4.2.71 - Guía animada de Capacitaciones IAFAS */
let cap71Index=0;
let cap71Timer=null;
let cap71Playing=true;
let cap71AutoPrompted=false;
const cap71Duration=5600;
function cap71Slides(){return Array.from(document.querySelectorAll('#cap71Guide .cap71-slide'));}
function cap71DotsBuild(){
  const wrap=$('cap71Dots'); if(!wrap)return;
  wrap.innerHTML=cap71Slides().map((_,i)=>`<button class="${i===cap71Index?'active':''}" onclick="cap71Go(${i})" aria-label="Ir a lámina ${i+1}"><span>${i+1}</span></button>`).join('');
}
function cap71Render(){
  const slides=cap71Slides(); if(!slides.length)return;
  cap71Index=(cap71Index+slides.length)%slides.length;
  slides.forEach((s,i)=>{s.classList.toggle('active',i===cap71Index);s.classList.toggle('before',i<cap71Index);});
  document.querySelectorAll('#cap71Dots button').forEach((d,i)=>d.classList.toggle('active',i===cap71Index));
  const p=$('cap71Progress'); if(p){p.style.transition='none';p.style.width='0%';requestAnimationFrame(()=>requestAnimationFrame(()=>{if(cap71Playing){p.style.transition=`width ${cap71Duration}ms linear`;p.style.width='100%';}}));}
  const btn=$('cap71PlayBtn');if(btn)btn.textContent=cap71Playing?'❚❚':'▶';
}
function cap71Schedule(){clearTimeout(cap71Timer);if(!cap71Playing)return;cap71Timer=setTimeout(()=>{cap71Index=(cap71Index+1)%Math.max(1,cap71Slides().length);cap71Render();cap71Schedule();},cap71Duration);}
function cap71Go(i){cap71Index=Number(i)||0;cap71Render();cap71Schedule();}
function cap71Next(){cap71Index++;cap71Render();cap71Schedule();}
function cap71Prev(){cap71Index--;cap71Render();cap71Schedule();}
function cap71TogglePlay(){cap71Playing=!cap71Playing;cap71Render();cap71Schedule();}
function cap71OpenGuide(auto=false){
  const g=$('cap71Guide');if(!g)return;
  g.hidden=false;g.setAttribute('aria-hidden','false');document.body.classList.add('cap71-guide-open');
  cap71Index=0;cap71Playing=true;cap71DotsBuild();cap71Render();cap71Schedule();
  if(auto)cap71AutoPrompted=true;
}
function cap71CloseGuide(){
  const g=$('cap71Guide');if(!g)return;clearTimeout(cap71Timer);g.hidden=true;g.setAttribute('aria-hidden','true');document.body.classList.remove('cap71-guide-open');
  const no=$('cap71DontShow');if(no?.checked){try{localStorage.setItem('iafas_cap71_guide_hide','1')}catch(e){}}
}
function cap71Finish(){try{localStorage.setItem('iafas_cap71_guide_hide','1')}catch(e){} cap71CloseGuide();}
function cap71MaybeAutoGuide(){
  if(cap71AutoPrompted)return;
  let hide=false;try{hide=localStorage.getItem('iafas_cap71_guide_hide')==='1'}catch(e){}
  if(!hide){cap71AutoPrompted=true;setTimeout(()=>{const page=$('capacitaciones');if(page?.classList.contains('show'))cap71OpenGuide(true);},450);}
}
document.addEventListener('keydown',e=>{const g=$('cap71Guide');if(!g||g.hidden)return;if(e.key==='Escape')cap71CloseGuide();if(e.key==='ArrowRight')cap71Next();if(e.key==='ArrowLeft')cap71Prev();});
const cap71RenderCapBase=renderCapacitaciones;
renderCapacitaciones=function(){cap71RenderCapBase();cap71MaybeAutoGuide();};


/* =========================================================
   v4.2.99 - Calculadora Profesional de Honorarios
   ========================================================= */
const HON_PROCS=window.HONORARIOS_PROCEDIMIENTOS||[];
const HON_META=window.HONORARIOS_CATALOGO_META||{};
const HON_RULES=window.HONORARIOS_REGLAS||{};
let honInitialized=false;
function honMoney(v){const n=Number(v||0);return 'S/ '+n.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function honNorm(v){return String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();}
function honSetText(id,value){if($(id))$(id).innerText=value;}
function honHideProcedureResults(){setTimeout(()=>{if($('honProcedureResults'))$('honProcedureResults').hidden=true;},160);}
function honRenderProcedureResults(query=''){
  const box=$('honProcedureResults'); if(!box) return;
  const q=honNorm(query).trim();
  if(!q){box.hidden=true;box.innerHTML='';return;}
  const matches=HON_PROCS.filter(p=>honNorm(p.nombre).includes(q)).slice(0,12);
  if(!matches.length){box.hidden=false;box.innerHTML='<div class="hon-procedure-empty">No se encontraron procedimientos con esa búsqueda.</div>';return;}
  box.hidden=false;
  box.innerHTML=matches.map(p=>`<div class="hon-procedure-option" onclick="honSelectProcedure(${JSON.stringify(p.nombre).replace(/"/g,'&quot;')})"><b>${esc(p.nombre)}</b><small>${esc(String(p.unidades))} unidades</small></div>`).join('');
}
function honSelectProcedure(name){
  if($('honProcedimiento'))$('honProcedimiento').value=name||'';
  if($('honProcedureResults'))$('honProcedureResults').hidden=true;
  honProcedureChanged();
}
function honInit(){
  if(honInitialized){honCalculate();return;} 
  honInitialized=true;
  if($('honCatalogoMeta'))$('honCatalogoMeta').innerText=HON_META.count?`${HON_META.count} procedimientos · fuente: ${HON_META.source||'tarifario de unidades'}`:`${HON_PROCS.length} procedimientos cargados`;
  honSetText('honProcCountTag', `${HON_META.count||HON_PROCS.length||0} procedimientos cargados`);
  document.addEventListener('click',ev=>{
    const shell=document.querySelector('.hon-search-shell');
    if(shell && !shell.contains(ev.target) && $('honProcedureResults')) $('honProcedureResults').hidden=true;
  });
  honCalculate();
}
function honFindProcedure(value){
  const q=honNorm(value); if(!q)return null;
  return HON_PROCS.find(p=>honNorm(p.nombre)===q)||HON_PROCS.find(p=>honNorm(p.nombre).includes(q))||null;
}
function honProcedureChanged(){
  const val=$('honProcedimiento')?.value||'';
  const p=honFindProcedure(val);
  if(val && (!p || honNorm(p.nombre)!==honNorm(val))) honRenderProcedureResults(val); else if($('honProcedureResults')) $('honProcedureResults').hidden=true;
  if(p){
    if($('honUnidades'))$('honUnidades').value=p.unidades||'';
    if($('honManualUnitWrap'))$('honManualUnitWrap').hidden=true;
    honSetText('honProcedureMeta',`${p.nombre} · ${p.unidades} unidades`);
  } else {
    if($('honUnidades'))$('honUnidades').value='';
    if($('honManualUnitWrap'))$('honManualUnitWrap').hidden=!val;
    honSetText('honProcedureMeta', val ? 'Procedimiento no identificado en el tarifario. Puedes ingresar unidades manuales.' : 'Selecciona un procedimiento para calcular.');
  }
  honCalculate();
}
function honCompanyRows(name){return factorSearchRows(name).filter(r=>String(r.CONVENIO_ACTIVO).toUpperCase()==='ACTIVO'&&String(r.ESTADO).toUpperCase()==='ACTIVO');}
function honCompanyFactor(name,key){
  const rows=honCompanyRows(name);
  const nums=[...new Set(rows.map(r=>String(r[key]??'').trim()).filter(factorIsNumeric))];
  const hasPending=rows.some(r=>/por validar/i.test(String(r[key]??'')));
  if(nums.length===1)return {ok:true,value:Number(nums[0]),rows,note:hasPending?'Existe además una regla específica por validar; confirmar si aplica.':''};
  if(nums.length>1)return {ok:false,value:null,note:`El ${key==='FACTOR HONORARIO'?'factor honorario':'factor servicios'} varía según regla o plan. Revisar Factores IAFAS.`,rows};
  if(hasPending)return {ok:false,value:null,note:'Factor por validar. Consultar con Convenios.',rows};
  return {ok:false,value:null,note:'No se encontró un factor numérico vigente.',rows};
}
function honFactorChanged(){honCalculate();}
function honGetUnits(){
  const proc=honFindProcedure($('honProcedimiento')?.value||'');
  if(proc) return {units:Number(proc.unidades||0), proc};
  const manual=Number($('honUnidadManual')?.value||0);
  return {units:manual>0?manual:0, proc:null};
}
function honCalculate(){
  if(!$('honorarios'))return;
  const iafa=$('honIaFA')?.value||'';
  const hf=iafa?honCompanyFactor(iafa,'FACTOR HONORARIO'):{ok:false,note:'Selecciona una IAFA'};
  const sf=iafa?honCompanyFactor(iafa,'FACTOR SERVICIO'):{ok:false,note:'Selecciona una IAFA'};
  honSetText('honFactor',hf.ok?String(hf.value):'-');
  honSetText('honFactorServicios',sf.ok?String(sf.value):'-');
  honSetText('honIntroFactorTag',`Factor honorario: ${hf.ok?hf.value:'-'}`);
  honSetText('honIntroServTag',`Factor servicios: ${sf.ok?sf.value:'-'}`);
  honSetText('honContextIaFA', `IAFA: ${iafa||'-'}`);
  honSetText('honContextFactorH', `Factor honorario: ${hf.ok?hf.value:'-'}`);
  honSetText('honContextFactorS', `Factor servicios: ${sf.ok?sf.value:'-'}`);
  if($('honFactorNote')){
    const notes=[];
    if(hf.ok) notes.push(`Factor honorario listo para cálculo.`); else if(hf.note) notes.push(hf.note);
    if(sf.ok) notes.push(`Sala de operaciones calculada con factor servicios.`); else if(sf.note && sf.note!==hf.note) notes.push(sf.note);
    $('honFactorNote').innerText=notes.join(' ')||'Selecciona una IAFA para cargar los factores vigentes.';
  }

  const {units, proc}=honGetUnits();
  if($('honUnidades'))$('honUnidades').value=units||'';
  if(proc) honSetText('honProcedureMeta',`${proc.nombre} · ${proc.unidades} unidades`);
  else if($('honProcedimiento')?.value) honSetText('honProcedureMeta', `Cálculo manual · ${units||0} unidades`);
  else honSetText('honProcedureMeta','Selecciona un procedimiento para calcular.');
  honSetText('honContextUnits', `Unidades: ${units||'-'}`);

  let surgeon=0, first=0, others=0, anest=0, instr=0, total=0;
  const rules=[];
  const validHonorarios=hf.ok&&units>0;
  const validServicios=sf.ok&&units>0;

  if(validHonorarios){
    const reint=Number($('honReintervencion')?.value||1);
    let baseSurgeon=units*hf.value*reint;
    let surchargePct=0;
    const noct=!!$('honNocturno')?.checked;
    const emergency=!!$('honEmergencia')?.checked;
    if(noct&&emergency){surchargePct+=Number(HON_RULES.nocturnoFeriado||20);rules.push('Nocturno / feriado +20%');}
    else if(noct&&!emergency){rules.push('Nocturno no aplicado: falta emergencia comprobada');}
    if($('honLaparoscopia')?.checked){surchargePct+=Number(HON_RULES.laparoscopica||50);rules.push('Laparoscópica / videoendoscópica +50%');}
    if($('honLuxo')?.checked){surchargePct+=Number(HON_RULES.luxofractura||30);rules.push('Luxo-fractura +30%');}
    if($('honInjerto')?.checked){surchargePct+=Number(HON_RULES.injertoOseo||50);rules.push('Obtención de injerto óseo +50%');}
    const complexity=Number($('honComplejidad')?.value||0);
    if(complexity){const applied=Math.min(complexity,Number(HON_RULES.complejidadMax||25));surchargePct+=applied;rules.push(`Complejidad +${applied}%`);}
    if(reint===0)rules.push('Reintervención ≤10 días: 0%');
    else if(reint===0.5)rules.push('Reintervención 11–30 días: 50%');

    const multiplier=1+surchargePct/100;
    surgeon=baseSurgeon*multiplier;
    const helpers=Number($('honAyudantes')?.value||0);
    first=helpers>=1?surgeon*(Number(HON_RULES.ayudante1||25)/100):0;
    others=helpers>1?(helpers-1)*surgeon*(Number(HON_RULES.ayudanteOtros||15)/100):0;
    const anestMin=Number(HON_RULES.anestesiaMinUnidades||15)*hf.value*reint;
    anest=Math.max(baseSurgeon*(Number(HON_RULES.anestesiologo||30)/100), anestMin) * multiplier;
    instr=surgeon*(Number(HON_RULES.instrumentista||6)/100);
    total=surgeon+first+others+anest+instr;
    honSetText('honFormula',`${units} unidades × ${hf.value} = ${honMoney(units*hf.value)}${reint!==1?` · reintervención ${reint*100}%`:''}${surchargePct?` · recargos +${surchargePct}%`:''}`);
    if($('honOtherHelpWrap')) $('honOtherHelpWrap').hidden = !(helpers>1);
    if($('honOtherHelpText')) $('honOtherHelpText').innerText = helpers>1 ? 'El total equipo quirúrgico incluye ayudantía adicional.' : 'Incluye cirujano, ayudantía, anestesia e instrumentista.';
  } else {
    honSetText('honFormula',!units?'Selecciona un procedimiento con unidades válidas.':'Factor honorario no validado.');
    if($('honOtherHelpWrap')) $('honOtherHelpWrap').hidden = true;
    if($('honOtherHelpText')) $('honOtherHelpText').innerText = 'Incluye cirujano, ayudantía, anestesia e instrumentista.';
  }

  // Sala de operaciones: cálculo base con unidades × factor servicios.
  // No se aplican recargos adicionales porque el manual revisado no define un porcentaje específico para este concepto.
  const sala=validServicios?(units*sf.value):0;
  honSetText('honSalaHero',honMoney(sala));
  honSetText('honSalaDecision',honMoney(sala));
  honSetText('honSalaFormula',validServicios?`${units} unidades × ${sf.value} = ${honMoney(sala)}`:(!units?'Selecciona un procedimiento con unidades válidas.':'Factor servicios no validado.'));

  honSetText('honCirujano',honMoney(surgeon));
  honSetText('honAyudante1',honMoney(first));
  honSetText('honAyudantesOtros',honMoney(others));
  honSetText('honAnestesia',honMoney(anest));
  honSetText('honInstrumentista',honMoney(instr));
  honSetText('honTotalEquipo',honMoney(total));
  honSetText('honTotalGeneral',honMoney(total+sala));

  const chips=[];
  if(validServicios) chips.push('Sala de operaciones calculada solo con factor servicios');
  if(validHonorarios && rules.length) chips.push(...rules);
  else if(validHonorarios) chips.push('Cálculo base sin condiciones especiales');
  if(!hf.ok && iafa) chips.push('Factor honorario pendiente de validación');
  if(!sf.ok && iafa) chips.push('Factor servicios pendiente de validación');
  if($('honAppliedRules')) $('honAppliedRules').innerHTML=chips.map(x=>`<span>${esc(x)}</span>`).join('');
}
function honReset(){
  ['honNocturno','honEmergencia','honLaparoscopia','honLuxo','honInjerto'].forEach(id=>{if($(id))$(id).checked=false;});
  if($('honProcedimiento'))$('honProcedimiento').value='';
  if($('honIaFA'))$('honIaFA').value='';
  if($('honComplejidad'))$('honComplejidad').value='0';
  if($('honReintervencion'))$('honReintervencion').value='1';
  if($('honAyudantes'))$('honAyudantes').value='1';
  if($('honUnidadManual'))$('honUnidadManual').value='';
  if($('honManualUnitWrap'))$('honManualUnitWrap').hidden=true;
  if($('honProcedureResults')){$('honProcedureResults').hidden=true;$('honProcedureResults').innerHTML='';}
  honSetText('honIntroFactorTag','Factor honorario: -');
  honSetText('honIntroServTag','Factor servicios: -');
  honCalculate();
}


/* v4.2.134 - Capacitaciones: centro de consulta operativo por Excel maestro simple */
let cap134Rows=[];
function cap134N(v){return capNorm(String(v||''));}
function cap134Knowledge(){return capData.filter(r=>String(r.tipo_registro||'CAPACITACION').toUpperCase()!=='FUENTE');}
function cap134Sources(){return capData.filter(r=>String(r.tipo_registro||'').toUpperCase()==='FUENTE');}
function cap134Unique(rows,key){return [...new Set(rows.map(key).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'es'));}
function cap134IafaName(r){return (r.iafas||r.iafa||'General').trim()||'General';}
function cap134Product(r){return (r.producto||'General').trim()||'General';}
function cap134Topic(r){return (r.grupo||r.tema||r.categoria||'General').trim()||'General';}
function cap134Text(r){return [r.iafas,r.producto,r.grupo,r.tema,r.pregunta,r.respuesta,r.accion,r.fuente,r.pagina,r.keywords,r.archivo_fuente].filter(Boolean).join(' ');}
function cap134Score(r,q){
  if(!q)return 1;
  const nq=cap134N(q), title=cap134N([r.pregunta,r.tema].join(' ')), body=cap134N(cap134Text(r)); let s=0;
  if(title.includes(nq))s+=120;if(body.includes(nq))s+=55;
  const toks=nq.split(/\s+/).filter(x=>x.length>1);for(const t of toks){if(title.includes(t))s+=13;if(body.includes(t))s+=4;}
  if(String(r.tipo_registro||'').toUpperCase()!=='FUENTE')s+=12;
  return s;
}
function cap134SetView(v,btn){
  document.querySelectorAll('#capacitaciones .cap134-view').forEach(x=>x.classList.remove('active'));
  const el=$('cap134View'+v.charAt(0).toUpperCase()+v.slice(1));if(el)el.classList.add('active');
  document.querySelectorAll('#capacitaciones .cap135-tabs button').forEach(x=>x.classList.toggle('active',x===btn||x.dataset.capview===v));
  if(v==='documentos')cap134RenderDocs();
}
function cap134FillSelect(id,values,label){const el=$(id);if(!el)return;const old=el.value;el.innerHTML=`<option value="ALL">${label}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if(values.includes(old))el.value=old;}
function cap134Init(){
  const knowledge=cap134Knowledge(), sources=cap134Sources();
  cap134FillSelect('cap134Iafa',cap134Unique(capData,cap134IafaName),'Todas las IAFAS');
  cap134FillSelect('cap134Producto',cap134Unique(knowledge,cap134Product),'Todos los productos');
  cap134FillSelect('cap134Tema',cap134Unique(knowledge,cap134Topic),'Todos los temas');
  const docs=new Set(sources.map(r=>`${r.fuente||''}|${r.archivo_fuente||''}`).filter(x=>x!=='|'));
  if($('cap134KpiKnowledge'))$('cap134KpiKnowledge').innerText=knowledge.length;
  if($('cap134KpiSources'))$('cap134KpiSources').innerText=sources.length;
  if($('cap134KpiIafas'))$('cap134KpiIafas').innerText=new Set(capData.map(cap134IafaName)).size;
  if($('cap134KpiDocs'))$('cap134KpiDocs').innerText=docs.size;
  if($('cap134SourceStatus'))$('cap134SourceStatus').innerText=`${knowledge.length} contenidos · ${sources.length} fuentes`;
  const quick=['Carta de garantía','SITEDS','Emergencia accidental','Carencia','Maternidad','Control Niño Sano','SCTR','Oncología'];
  if($('cap134Quick'))$('cap134Quick').innerHTML=quick.map(q=>`<button onclick="cap134Quick('${q.replace(/'/g,"\\'")}')">${esc(q)}</button>`).join('');
  cap134RenderIafas();cap134RenderDocs();
  if($('cap135AnswerArea'))$('cap135AnswerArea').hidden=true;
  if($('cap135Browse'))$('cap135Browse').hidden=false;
  if($('cap134IafaCards'))$('cap134IafaCards').style.display='grid';
}
function cap134Quick(q){if($('cap134Query'))$('cap134Query').value=q;cap134SetView('consulta',document.querySelector('[data-capview="consulta"]'));cap134Search(true);}
function cap134Clear(){
  if($('cap134Query'))$('cap134Query').value='';
  ['cap134Iafa','cap134Producto','cap134Tema'].forEach(id=>{if($(id))$(id).value='ALL'});
  cap134Rows=[];
  if($('cap134Results'))$('cap134Results').innerHTML='';
  if($('cap134Count'))$('cap134Count').innerText='0';
  if($('cap134Detail'))$('cap134Detail').innerHTML='<div class="cap134-empty-detail"><b>Selecciona un resultado</b><p>Aquí verás qué aplica, qué debes hacer y la fuente.</p></div>';
  if($('cap135AnswerArea'))$('cap135AnswerArea').hidden=true;
  if($('cap135Browse'))$('cap135Browse').hidden=false;
}
function cap134Show(i,btn){
  document.querySelectorAll('#cap134Results .cap134-result').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');const r=cap134Rows[i];if(!r)return;
  const isSource=String(r.tipo_registro||'').toUpperCase()==='FUENTE';const source=[r.fuente,r.pagina?`p. ${r.pagina}`:''].filter(Boolean).join(' · ');const action=(r.accion||r.decision||'').trim();
  $('cap134Detail').innerHTML=`<div class="cap134-detail-head"><div><span>${esc(cap134IafaName(r))}</span><span>${esc(cap134Product(r))}</span><span>${esc(cap134Topic(r))}</span></div><h3>${esc(r.pregunta||r.tema||'Capacitación')}</h3>${isSource?'<small>Contenido textual de la fuente</small>':'<small>Conocimiento operativo publicado</small>'}</div><div class="cap134-detail-body"><section><b>Respuesta / regla</b><p>${esc(r.respuesta||'-')}</p></section>${action?`<section class="action"><b>Qué hacer</b><p>${esc(action)}</p></section>`:''}<section class="meta"><b>Fuente</b><p>${esc(source||'Fuente no identificada')}</p>${r.archivo_fuente?`<small>Archivo: ${esc(r.archivo_fuente)}</small>`:''}</section></div>`;
}
function cap134RenderIafas(){const root=$('cap134IafaCards');if(!root)return;const rows=cap134Knowledge();const names=cap134Unique(rows,cap134IafaName);root.innerHTML=names.map(n=>{const rr=rows.filter(r=>cap134IafaName(r)===n);const products=cap134Unique(rr,cap134Product).slice(0,5);const topics=cap134Unique(rr,cap134Topic).slice(0,6);return `<article class="cap134-iafa-card"><span>${esc(n)}</span><strong>${rr.length} contenidos</strong><p>${products.map(esc).join(' · ')||'General'}</p><div>${topics.map(t=>`<i>${esc(t)}</i>`).join('')}</div><button onclick="cap134OpenIafa('${String(n).replace(/'/g,"\\'")}')">Consultar ${esc(n)}</button></article>`}).join('');}
function cap134OpenIafa(n){cap134SetView('consulta',document.querySelector('[data-capview="consulta"]'));if($('cap134Iafa'))$('cap134Iafa').value=n;cap134Search();}

function cap135SelectIafa(n){
  if($('cap134Iafa'))$('cap134Iafa').value=n;
  const rows=cap134Knowledge().filter(r=>cap134IafaName(r)===n);
  const topics=cap134Unique(rows,cap134Topic);
  if($('cap135TopicKicker'))$('cap135TopicKicker').innerText=n;
  if($('cap135TopicTitle'))$('cap135TopicTitle').innerText='¿Qué quieres consultar?';
  if($('cap135TopicChips'))$('cap135TopicChips').innerHTML=topics.map(t=>`<button onclick="cap135OpenTopic('${String(n).replace(/'/g,"\'")}','${String(t).replace(/'/g,"\'")}')">${esc(t)}</button>`).join('');
  if($('cap135TopicPanel'))$('cap135TopicPanel').hidden=false;
  if($('cap134IafaCards'))$('cap134IafaCards').style.display='none';
  document.getElementById('cap135TopicPanel')?.scrollIntoView({behavior:'smooth',block:'center'});
}
function cap135ResetIafa(){
  if($('cap134Iafa'))$('cap134Iafa').value='ALL';
  if($('cap134Tema'))$('cap134Tema').value='ALL';
  if($('cap135TopicPanel'))$('cap135TopicPanel').hidden=true;
  if($('cap134IafaCards'))$('cap134IafaCards').style.display='grid';
}
function cap135OpenTopic(n,t){
  if($('cap134Iafa'))$('cap134Iafa').value=n;
  if($('cap134Tema'))$('cap134Tema').value=t;
  if($('cap134Query'))$('cap134Query').value='';
  cap134Search(true);
}
function cap135GoUpdate(){
  const b=menuBtn('fuentes');go('fuentes',b);
  setTimeout(()=>{const s=$('sourceType');if(s){s.value='capacitaciones_master';s.dispatchEvent(new Event('change',{bubbles:true}));}},150);
}
function cap134RenderDecisions(){const root=$('cap134DecisionCards');if(!root)return;const keys=['carta de garantia','siteds','carencia','emergencia','hospitaliz','maternidad','nino sano','sctr','soat','oncolog'];const rows=cap134Knowledge().filter(r=>keys.some(k=>cap134N(cap134Text(r)).includes(k))).slice(0,36);root.innerHTML=rows.map(r=>`<button class="cap134-decision-card" onclick="cap134OpenRecord('${String(r.id||'').replace(/'/g,"\\'")}')"><span>${esc(cap134IafaName(r))} · ${esc(cap134Product(r))}</span><strong>${esc(r.pregunta||r.tema)}</strong><p>${esc(String(r.respuesta||'').slice(0,180))}${String(r.respuesta||'').length>180?'…':''}</p></button>`).join('');}
function cap134OpenRecord(id){const r=capData.find(x=>String(x.id)===String(id));if(!r)return;cap134SetView('consulta',document.querySelector('[data-capview="consulta"]'));if($('cap134Query'))$('cap134Query').value=r.pregunta||r.tema||'';cap134Search(true);}
function cap134RenderFaq(){const root=$('cap134FaqList');if(!root)return;let rows=cap134Knowledge().filter(r=>/[?¿]/.test(r.pregunta||'')||/^(que|como|cuando|donde|quien|cual|qué|cómo|cuándo|dónde|quién|cuál)\b/i.test((r.pregunta||'').trim())).slice(0,50);if(!rows.length)rows=cap134Knowledge().slice(0,30);root.innerHTML=rows.map(r=>`<button onclick="cap134OpenRecord('${String(r.id||'').replace(/'/g,"\\'")}')"><span>${esc(cap134IafaName(r))}</span><strong>${esc(r.pregunta||r.tema)}</strong><small>${esc(r.fuente||'')}</small></button>`).join('');}
function cap134RenderDocs(){const root=$('cap134Docs');if(!root)return;const map=new Map();for(const r of cap134Sources()){const k=[r.iafas||'',r.fuente||'',r.archivo_fuente||''].join('|');if(!map.has(k))map.set(k,{iafa:cap134IafaName(r),name:r.fuente||r.archivo_fuente||'Documento',file:r.archivo_fuente||'',year:r.anio||'',pages:new Set(),topics:new Set()});const d=map.get(k);d.pages.add(String(r.pagina||''));d.topics.add(cap134Topic(r));}root.innerHTML=[...map.values()].sort((a,b)=>a.iafa.localeCompare(b.iafa,'es')||a.name.localeCompare(b.name,'es')).map(d=>`<article class="cap134-doc-card"><span>${esc(d.iafa)}${d.year?` · ${esc(d.year)}`:''}</span><strong>${esc(d.name)}</strong><p>${d.pages.size} página${d.pages.size===1?'':'s'}/lámina${d.pages.size===1?'':'s'} indexada${d.pages.size===1?'':'s'}</p><div>${[...d.topics].slice(0,5).map(t=>`<i>${esc(t)}</i>`).join('')}</div>${d.file?`<small>${esc(d.file)}</small>`:''}</article>`).join('');}
renderCapacitaciones=function(){if(!$('cap134Query'))return;cap134Init();};


/* =========================================================
   v4.2.136 - Capacitaciones IAFAS: centro de consulta práctico
   ========================================================= */
const CAP136_ROUTES=[
  {key:'cg',label:'Carta de garantía',desc:'Requisitos, procedimientos, vigencia y excepciones',icon:'CG',terms:['carta de garantia','garantia','cg']},
  {key:'emergencia',label:'Emergencia',desc:'Ingreso, continuidad, accidentes y atención inmediata',icon:'EM',terms:['emergencia','accidente','continuidad']},
  {key:'maternidad',label:'Maternidad',desc:'Prenatal, parto, postnatal y coberturas asociadas',icon:'MA',terms:['maternidad','prenatal','postnatal','gestante','parto']},
  {key:'nino',label:'Niño sano',desc:'Controles, edades, vacunas y frecuencias',icon:'NS',terms:['nino sano','niño sano','recien nacido','recién nacido','cred']},
  {key:'oncologia',label:'Oncología',desc:'Activación, autorización y atención oncológica',icon:'ON',terms:['oncolog','quimioterapia','radioterapia']},
  {key:'sctr',label:'SCTR / Accidentes',desc:'Validación, documentos y continuidad de atención',icon:'SC',terms:['sctr','accidente personal','accidentes personales']},
  {key:'siteds',label:'SITEDS',desc:'Validación de afiliación, cobertura y códigos',icon:'SI',terms:['siteds','acreditacion','acreditación']},
  {key:'hospital',label:'Hospitalización',desc:'Ingreso, ampliaciones y control posterior',icon:'HO',terms:['hospitaliz','hospitalario','alta','post hospital']}
];
let cap136Rows=[];
let cap136State={iafa:'ALL',producto:'ALL',tema:'ALL',route:'ALL',query:''};
function cap136Norm(v){return capNorm(String(v||''));}
function cap136Knowledge(){return capData.filter(r=>String(r.tipo_registro||'CAPACITACION').toUpperCase()!=='FUENTE');}
function cap136Sources(){return capData.filter(r=>String(r.tipo_registro||'').toUpperCase()==='FUENTE');}
function cap136Iafa(r){return (r.iafas||r.iafa||'General').trim()||'General';}
function cap136Product(r){return (r.producto||'General').trim()||'General';}
function cap136Topic(r){return (r.tema||r.grupo||r.categoria||'General').trim()||'General';}
function cap136Unique(rows,fn){return [...new Set(rows.map(fn).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'es'))}
function cap136Text(r){return [r.iafas,r.iafa,r.producto,r.grupo,r.categoria,r.tema,r.pregunta,r.respuesta,r.resumen,r.accion,r.decision,r.revisar,r.alerta,r.alertas,r.fuente,r.pagina,r.keywords,r.aliases,r.archivo_fuente].filter(Boolean).join(' ')}
function cap136RouteMatch(r,key){if(!key||key==='ALL')return true;const route=CAP136_ROUTES.find(x=>x.key===key);if(!route)return true;const t=cap136Norm(cap136Text(r));return route.terms.some(term=>t.includes(cap136Norm(term)));}
function cap136Score(r,q){
  const nq=cap136Norm(q); if(!nq)return 1;
  const title=cap136Norm([r.pregunta,r.tema,r.grupo].join(' '));
  const answer=cap136Norm([r.respuesta,r.resumen,r.accion,r.decision,r.revisar,r.alerta,r.alertas].join(' '));
  const meta=cap136Norm([r.iafas,r.producto,r.fuente,r.keywords,r.aliases].join(' '));
  let s=0;if(title.includes(nq))s+=120;if(answer.includes(nq))s+=70;if(meta.includes(nq))s+=45;
  const toks=nq.split(/\s+/).filter(x=>x.length>1);
  for(const t of toks){if(title.includes(t))s+=15;if(answer.includes(t))s+=8;if(meta.includes(t))s+=5;}
  return s;
}
function cap136SetView(v,btn){
  document.querySelectorAll('#capacitaciones .cap136-view').forEach(x=>x.classList.remove('active'));
  const el=$('cap136View'+v.charAt(0).toUpperCase()+v.slice(1));if(el)el.classList.add('active');
  document.querySelectorAll('#capacitaciones .cap136-tabs button').forEach(x=>x.classList.toggle('active',x===btn||x.dataset.cap136View===v));
  if(v==='documentos')cap136RenderDocs();
}
function cap136RenderRoutes(){
  const root=$('cap136Routes');if(!root)return;
  root.innerHTML=CAP136_ROUTES.map(r=>{const n=cap136Knowledge().filter(x=>cap136RouteMatch(x,r.key)).length;return `<button class="cap136-route" onclick="cap136OpenRoute('${r.key}')"><span class="cap136-route-icon">${r.icon}</span><div><strong>${esc(r.label)}</strong><p>${esc(r.desc)}</p><small>${n} contenidos disponibles</small></div><i>→</i></button>`}).join('');
}
function cap136RenderIafas(){
  const root=$('cap136Iafas');if(!root)return;const rows=cap136Knowledge();
  const names=cap136Unique(rows,cap136Iafa).filter(n=>n && n!=='General');
  root.innerHTML=names.map(n=>{const rr=rows.filter(r=>cap136Iafa(r)===n);const topics=cap136Unique(rr,cap136Topic);return `<button onclick="cap136OpenIafa('${String(n).replace(/'/g,"\\'")}')"><span>${esc(n)}</span><small>${topics.length} temas · ${rr.length} contenidos</small><i>→</i></button>`}).join('');
}
function cap136OpenRoute(key){cap136State={iafa:'ALL',producto:'ALL',tema:'ALL',route:key,query:''};if($('cap136Query'))$('cap136Query').value='';cap136Search(true);}
function cap136OpenIafa(name){
  cap136State={iafa:name,producto:'ALL',tema:'ALL',route:'ALL',query:''};
  const rows=cap136Knowledge().filter(r=>cap136Iafa(r)===name);
  const products=cap136Unique(rows,cap136Product);const topics=cap136Unique(rows,cap136Topic);
  if($('cap136Home'))$('cap136Home').hidden=true;if($('cap136ResultsArea'))$('cap136ResultsArea').hidden=true;if($('cap136Explore'))$('cap136Explore').hidden=false;
  if($('cap136ExploreKicker'))$('cap136ExploreKicker').innerText=name;
  if($('cap136ExploreTitle'))$('cap136ExploreTitle').innerText=`¿Qué quieres consultar de ${name}?`;
  if($('cap136ExploreDesc'))$('cap136ExploreDesc').innerText='Puedes filtrar primero por producto o entrar directamente a un tema.';
  if($('cap136Products'))$('cap136Products').innerHTML=products.map(p=>`<button class="${cap136State.producto===p?'active':''}" onclick="cap136SelectProduct('${String(p).replace(/'/g,"\\'")}')">${esc(p)}</button>`).join('');
  if($('cap136Topics'))$('cap136Topics').innerHTML=topics.map(t=>{const n=rows.filter(r=>cap136Topic(r)===t).length;return `<button onclick="cap136OpenTopic('${String(t).replace(/'/g,"\\'")}')"><strong>${esc(t)}</strong><small>${n} contenidos</small><i>Consultar →</i></button>`}).join('');
  cap136RenderActiveFilters();
}
function cap136SelectProduct(product){cap136State.producto=product;const rows=cap136Knowledge().filter(r=>cap136Iafa(r)===cap136State.iafa && cap136Product(r)===product);const topics=cap136Unique(rows,cap136Topic);if($('cap136Products'))Array.from($('cap136Products').children).forEach(b=>b.classList.toggle('active',b.textContent.trim()===product));if($('cap136Topics'))$('cap136Topics').innerHTML=topics.map(t=>{const n=rows.filter(r=>cap136Topic(r)===t).length;return `<button onclick="cap136OpenTopic('${String(t).replace(/'/g,"\\'")}')"><strong>${esc(t)}</strong><small>${n} contenidos</small><i>Consultar →</i></button>`}).join('');cap136RenderActiveFilters();}
function cap136OpenTopic(topic){cap136State.tema=topic;cap136Search(true);}
function cap136RenderActiveFilters(){const root=$('cap136ActiveFilters');if(!root)return;const chips=[];if(cap136State.iafa!=='ALL')chips.push(cap136State.iafa);if(cap136State.producto!=='ALL')chips.push(cap136State.producto);if(cap136State.tema!=='ALL')chips.push(cap136State.tema);if(cap136State.route!=='ALL'){const r=CAP136_ROUTES.find(x=>x.key===cap136State.route);if(r)chips.push(r.label)};root.innerHTML=chips.length?`<span>Consulta activa:</span>${chips.map(x=>`<b>${esc(x)}</b>`).join('')}`:'';}
function cap136Reset(){cap136State={iafa:'ALL',producto:'ALL',tema:'ALL',route:'ALL',query:''};cap136Rows=[];if($('cap136Query'))$('cap136Query').value='';if($('cap136Home'))$('cap136Home').hidden=false;if($('cap136Explore'))$('cap136Explore').hidden=true;if($('cap136ResultsArea'))$('cap136ResultsArea').hidden=true;cap136RenderActiveFilters();window.scrollTo({top:0,behavior:'smooth'});}
function cap136Search(force){
  const q=($('cap136Query')?.value||'').trim();cap136State.query=q;
  let scored=cap136Knowledge().map(r=>({r,score:cap136Score(r,q)})).filter(x=>x.score>0);
  if(cap136State.iafa!=='ALL')scored=scored.filter(x=>cap136Iafa(x.r)===cap136State.iafa);
  if(cap136State.producto!=='ALL')scored=scored.filter(x=>cap136Product(x.r)===cap136State.producto);
  if(cap136State.tema!=='ALL')scored=scored.filter(x=>cap136Topic(x.r)===cap136State.tema);
  if(cap136State.route!=='ALL')scored=scored.filter(x=>cap136RouteMatch(x.r,cap136State.route));
  scored.sort((a,b)=>b.score-a.score||String(a.r.pregunta||'').localeCompare(String(b.r.pregunta||''),'es'));
  cap136Rows=scored.slice(0,60).map(x=>x.r);
  if(!q && cap136State.iafa==='ALL'&&cap136State.tema==='ALL'&&cap136State.route==='ALL'){cap136Reset();return;}
  if($('cap136Home'))$('cap136Home').hidden=true;if($('cap136Explore'))$('cap136Explore').hidden=true;if($('cap136ResultsArea'))$('cap136ResultsArea').hidden=false;
  const route=CAP136_ROUTES.find(x=>x.key===cap136State.route);const title=q?`Resultados para “${q}”`:cap136State.tema!=='ALL'?cap136State.tema:route?route.label:cap136State.iafa!=='ALL'?cap136State.iafa:'Información encontrada';
  if($('cap136ResultsTitle'))$('cap136ResultsTitle').innerText=title;
  if($('cap136Count'))$('cap136Count').innerText=`${cap136Rows.length} resultado${cap136Rows.length===1?'':'s'}`;
  if($('cap136ResultsHint'))$('cap136ResultsHint').innerText=cap136Rows.length?'Abre una coincidencia para revisar la respuesta completa y su respaldo.':'No hay información publicada para esa combinación.';
  cap136RenderActiveFilters();cap136RenderResults();
}
function cap136RenderResults(){
  const root=$('cap136Results');if(!root)return;
  if(!cap136Rows.length){root.innerHTML='<div class="cap136-empty"><b>No encontré información sustentada</b><p>Prueba con una búsqueda más corta, cambia la IAFA o revisa las fuentes documentales.</p></div>';if($('cap136Detail'))$('cap136Detail').innerHTML='<div class="cap136-empty-detail"><b>Sin respuesta publicada</b><p>El Hub no completará una regla que no esté cargada en la base.</p></div>';return;}
  root.innerHTML=cap136Rows.map((r,i)=>`<button class="cap136-result" onclick="cap136Show(${i},this)"><div class="cap136-result-meta"><span>${esc(cap136Iafa(r))}</span><em>${esc(cap136Product(r))}</em></div><strong>${esc(r.pregunta||r.tema||'Contenido de capacitación')}</strong><p>${esc(String(r.respuesta||r.resumen||'').slice(0,170))}${String(r.respuesta||r.resumen||'').length>170?'…':''}</p><small>${esc(cap136Topic(r))}${r.pagina?` · p. ${esc(r.pagina)}`:''}</small></button>`).join('');
  cap136Show(0,root.querySelector('.cap136-result'));
}
function cap136Show(i,btn){
  document.querySelectorAll('#cap136Results .cap136-result').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');const r=cap136Rows[i];if(!r)return;
  const answer=(r.respuesta||r.resumen||'').trim();const action=(r.accion||r.decision||'').trim();const review=(r.revisar||'').trim();const alert=(r.alerta||r.alertas||'').trim();const source=[r.fuente,r.pagina?`p. ${r.pagina}`:''].filter(Boolean).join(' · ');const pdf=(r.pdf||'').trim();const page=r.pagelink||String(r.pagina||'').split(' ')[0]||1;
  const sections=[];
  if(answer)sections.push(`<section class="cap136-section cap136-answer"><div class="cap136-section-label"><span>1</span><b>Respuesta</b></div><p>${esc(answer)}</p></section>`);
  if(action)sections.push(`<section class="cap136-section cap136-action"><div class="cap136-section-label"><span>2</span><b>Qué debe hacer el personal</b></div><p>${esc(action)}</p></section>`);
  if(review)sections.push(`<section class="cap136-section"><div class="cap136-section-label"><span>3</span><b>Qué debe validar</b></div><p>${esc(review)}</p></section>`);
  if(alert)sections.push(`<section class="cap136-section cap136-alert"><div class="cap136-section-label"><span>!</span><b>Atención / excepción</b></div><p>${esc(alert)}</p></section>`);
  $('cap136Detail').innerHTML=`<header class="cap136-detail-head"><div class="cap136-detail-tags"><span>${esc(cap136Iafa(r))}</span><span>${esc(cap136Product(r))}</span><span>${esc(cap136Topic(r))}</span></div><h3>${esc(r.pregunta||r.tema||'Capacitación')}</h3><small>Información sustentada en la base de capacitaciones</small></header><div class="cap136-detail-body">${sections.join('')}<section class="cap136-source"><div><b>Fuente</b><p>${esc(source||'Fuente no identificada')}</p>${r.archivo_fuente?`<small>${esc(r.archivo_fuente)}</small>`:''}</div>${pdf?`<a href="${esc(pdf)}#page=${esc(page)}" target="_blank" rel="noopener">Abrir documento</a>`:''}</section></div>`;
}
function cap136RenderDocs(){
  const root=$('cap136Docs');if(!root)return;const q=cap136Norm($('cap136DocQuery')?.value||'');const map=new Map();
  for(const r of cap136Sources()){const key=[cap136Iafa(r),r.fuente||'',r.archivo_fuente||''].join('|');if(!map.has(key))map.set(key,{iafa:cap136Iafa(r),name:r.fuente||r.archivo_fuente||'Documento',file:r.archivo_fuente||'',year:r.anio||'',pages:new Set(),topics:new Set()});const d=map.get(key);if(r.pagina)d.pages.add(String(r.pagina));if(cap136Topic(r))d.topics.add(cap136Topic(r));}
  let docs=[...map.values()];if(q)docs=docs.filter(d=>cap136Norm([d.iafa,d.name,d.file,d.year,[...d.topics].join(' ')].join(' ')).includes(q));
  docs.sort((a,b)=>a.iafa.localeCompare(b.iafa,'es')||a.name.localeCompare(b.name,'es'));
  root.innerHTML=docs.length?docs.map(d=>`<article class="cap136-doc-card"><div><span>${esc(d.iafa)}${d.year?` · ${esc(d.year)}`:''}</span><strong>${esc(d.name)}</strong><p>${d.pages.size} página${d.pages.size===1?'':'s'}/lámina${d.pages.size===1?'':'s'} indexada${d.pages.size===1?'':'s'}</p></div><div class="cap136-doc-topics">${[...d.topics].slice(0,6).map(t=>`<i>${esc(t)}</i>`).join('')}</div>${d.file?`<small>${esc(d.file)}</small>`:''}</article>`).join(''):'<div class="cap136-empty"><b>No se encontraron documentos</b><p>Prueba con otro nombre o IAFA.</p></div>';
}
function cap136Init(){cap136RenderRoutes();cap136RenderIafas();cap136RenderDocs();cap136RenderActiveFilters();if($('cap136Home'))$('cap136Home').hidden=false;if($('cap136Explore'))$('cap136Explore').hidden=true;if($('cap136ResultsArea'))$('cap136ResultsArea').hidden=true;}
renderCapacitaciones=function(){if(!$('cap136Query'))return;cap136Init();};

/* v4.2.138 · LISTAS AB: Excel final 22SEP2026 + build automático GitHub/Netlify */
