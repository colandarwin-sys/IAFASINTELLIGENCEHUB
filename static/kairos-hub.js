(function(){
  'use strict';
  const IGV=0.18, PVF_FACTOR=1.33, LOWER_TOLERANCE=0.05;
  const STORAGE_KEY='iafas_hub_kairos_records_v1';
  const COMPANIES={
    pacifico:{id:'pacifico',name:'PACÍFICO',discount:0.40,rule:'PPS Kairos -40%',fallback:'pacifico_leadership'},
    rimac:{id:'rimac',name:'RÍMAC',discount:0.25,rule:'PPS Kairos -25%',fallback:'rimac_contract'},
    mapfre:{id:'mapfre',name:'MAPFRE EPS / SEGUROS',discount:0.15,rule:'PPS Kairos -15%',fallback:'zone'},
    sanitas:{id:'sanitas',name:'SANITAS EPS',discount:0.25,rule:'PPS Kairos -25%',fallback:'zone'},
    positiva:{id:'positiva',name:'LA POSITIVA EPS / SEGUROS',discount:0.20,rule:'PPS Kairos -20%',fallback:'zone'}
  };
  const STATUS={adequate:'PRECIO ADECUADO',gray:'ZONA GRIS — CONVENIR',under:'PRECIO POR DEBAJO — ESCALAR',over:'SOBREVALORACIÓN TARIFARIA: ESTAMOS GANANDO'};
  let khLast=null;
  let khStep=1;
  let khMaxStep=1;
  function el(id){return document.getElementById(id);}
  function num(v){const s=String(v??'').trim();if(!s)return NaN;let t=s.replace(/\s/g,'');if(t.includes(',')&&t.includes('.'))t=t.replace(/\./g,'').replace(',','.');else if(t.includes(','))t=t.replace(',','.');t=t.replace(/[^0-9.-]/g,'');const n=Number(t);return Number.isFinite(n)?n:NaN;}
  function money(v){const n=Number(v);return Number.isFinite(n)?`S/ ${n.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`:'S/ 0.00';}
  function pct(v){return Number.isFinite(Number(v))?`${Number(v).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}%`:'0.00%';}
  function round2(n){return Math.round((Number(n)+Number.EPSILON)*100)/100;}
  function text(v){return String(v??'').trim();}
  function detectUnits(s){const t=text(s);const matches=[...t.matchAll(/(?:\bx\s*|×\s*)(\d+)\b/gi)];if(!matches.length)return 1;const n=Number(matches[matches.length-1][1]);return Number.isFinite(n)&&n>0?n:1;}
  function unitLabels(s){const t=text(s);let inner='unidad interna',pack='presentación';
    const units=detectUnits(t);
    const terms=[[/\btab(?:leta|letas)?\b\.?/i,'tableta'],[/\bcomp(?:rimido|rimidos)?\b\.?/i,'comprimido'],[/\bc[aá]ps?(?:ula|ulas)?\b\.?/i,'cápsula'],[/\bamp(?:olla|ollas)?\b\.?/i,'ampolla'],[/\bvial(?:es)?\b/i,'vial'],[/\bjeringa(?:s)?\b/i,'jeringa'],[/\bsobre(?:s)?\b/i,'sobre'],[/\b[oó]vulo(?:s)?\b/i,'óvulo'],[/\bsupositorio(?:s)?\b/i,'supositorio'],[/\bparche(?:s)?\b/i,'parche']];
    for(const [re,label] of terms){if(re.test(t)){inner=label;break;}}
    const packs=[[/\bcaja\b/i,'caja'],[/\bfrasco\b/i,'frasco'],[/\bbl[ií]ster\b/i,'blíster'],[/\bbolsa\b/i,'bolsa'],[/\benvase\b/i,'envase'],[/\bpaquete\b/i,'paquete'],[/\bkit\b/i,'kit'],[/\btubo\b/i,'tubo'],[/\bsachet\b/i,'sachet']];
    for(const [re,label] of packs){if(re.test(t)){pack=label;break;}}
    return {units,inner,pack};
  }
  function getState(){const labels=unitLabels(el('khPresentation')?.value||'');return {
    insurer:el('khInsurer')?.value||'',medication:text(el('khMedication')?.value),presentation:text(el('khPresentation')?.value),
    pvf:num(el('khPvf')?.value),pps:num(el('khPps')?.value),units:Math.max(num(el('khUnits')?.value)||labels.units,1),
    quantity:Math.max(num(el('khQuantity')?.value)||0,0),totalMv:num(el('khTotalMv')?.value),basis:el('khBasis')?.value||'auto',purchase:num(el('khPurchase')?.value),exempt:!!el('khExempt')?.checked,labels
  };}
  function mvUnitPrice(s){return s.quantity>0&&Number.isFinite(s.totalMv)?s.totalMv/s.quantity:NaN;}
  function fullReference(s){if(Number.isFinite(s.pps)&&s.pps>0)return s.pps;if(Number.isFinite(s.pvf)&&s.pvf>0)return s.pvf;return NaN;}
  function detectBasis(s){if(s.units<=1)return {basis:'inner',confidence:'high',reason:'La presentación contiene una sola unidad.'};const mv=mvUnitPrice(s),full=fullReference(s);if(!(mv>0)&&mv!==0)return {basis:null,confidence:'none',reason:'Ingresa el Total MV para detectar la escala.'};if(!(full>0))return {basis:null,confidence:'none',reason:'Falta PPS/PVF para homologar automáticamente la unidad.'};const inner=full/s.units;const dP=Math.abs(Math.log(mv/full)),dI=Math.abs(Math.log(mv/inner)),margin=Math.abs(dP-dI),basis=dP<dI?'presentation':'inner',confidence=margin>=Math.log(3)?'high':(margin>=Math.log(1.6)?'medium':'low');return {basis,confidence,full,inner,mv};}
  function resolveBasis(s){if(s.units<=1)return {basis:'inner',confidence:'high',source:'equivalent'};if(s.basis==='inner'||s.basis==='presentation')return {basis:s.basis,confidence:'high',source:'manual'};const d=detectBasis(s);return d.confidence==='high'?{...d,source:'auto'}:{...d,basis:null,source:'auto'};}
  function standardPps(s,company){const sourceUnit=s.pps/s.units,noIgv=sourceUnit/(1+IGV),allowed=noIgv*(1-company.discount);return {kind:'contractual',method:'PPS Kairos',message:company.rule,basisNative:'inner',sourceUnit,noIgv,allowed,validation:'Contrato'};}
  function pvfFallback(s,company,leadership=false){const ppsRef=s.pvf*PVF_FACTOR,sourceUnit=ppsRef/s.units,noIgv=sourceUnit/(1+IGV),allowed=noIgv*(1-company.discount);return {kind:leadership?'operational_validated':'contractual',method:'PVF × 1.33',message:leadership?'NO EN CONTRATO — VALIDADO POR LIDERAZGO':'Ruta contractual por ausencia de PPS',basisNative:'inner',ppsReference:ppsRef,sourceUnit,noIgv,allowed,validation:leadership?'Liderazgo':'Contrato'};}
  function calcRule(s){const c=COMPANIES[s.insurer];if(!c)return {kind:'pending',method:'-',message:'Selecciona una IAFA.',validation:'-'};if(Number.isFinite(s.pps)&&s.pps>0)return standardPps(s,c);if(c.fallback==='pacifico_leadership'){
      if(Number.isFinite(s.pvf)&&s.pvf>0)return pvfFallback(s,c,true);return {kind:'zone_gray',method:'Sin PPS/PVF',message:'ZONA GRIS — CONVENIR',detail:'Pacífico: no existe base para aplicar la regla operativa PVF ×1.33.',validation:'Pendiente'};}
    if(c.fallback==='rimac_contract'){
      if(Number.isFinite(s.pvf)&&s.pvf>0)return pvfFallback(s,c,false);if(Number.isFinite(s.purchase)&&s.purchase>0)return {kind:'contractual',method:'Precio de compra +5%',message:'Ruta contractual por ausencia de PPS y PVF',basisNative:'mv',sourceUnit:s.purchase,noIgv:s.purchase,allowed:s.purchase*1.05,validation:'Contrato'};return {kind:'input_needed',method:'Sin PPS/PVF',message:'INGRESE PRECIO DE COMPRA SIN IGV',detail:'Rímac permite precio de compra +5% cuando Kairos no registra PPS ni PVF.',validation:'Contrato'};}
    return {kind:'zone_gray',method:Number.isFinite(s.pvf)&&s.pvf>0?'PVF disponible, PPS ausente':'Sin PPS',message:'ZONA GRIS — CONVENIR',detail:`${c.name}: sin PPS no se aplica una fórmula sustituta automática.`,validation:'Pendiente'};
  }
  function allowedForBasis(rule,basis,s){if(!Number.isFinite(rule.allowed))return NaN;if(rule.basisNative==='mv')return rule.allowed;if(!basis)return NaN;return basis==='presentation'?rule.allowed*s.units:rule.allowed;}
  function classify(mvTotal,allowedTotal){if(!(Number.isFinite(mvTotal)&&Number.isFinite(allowedTotal)&&allowedTotal>0))return {code:'pending',label:'PENDIENTE',cls:'pending'};const delta=round2(mvTotal-allowedTotal),ratio=Math.abs(delta)/allowedTotal,p=(delta/allowedTotal)*100;if(delta>0)return {code:'over',label:STATUS.over,cls:'over',delta,p};if(delta<0&&ratio>LOWER_TOLERANCE+1e-12)return {code:'under',label:STATUS.under,cls:'under',delta,p};return {code:'adequate',label:STATUS.adequate,cls:'adequate',delta,p};}
  function calculate(){const s=getState(),rule=calcRule(s),basis=resolveBasis(s),mvUnit=mvUnitPrice(s);let outcome={code:'pending',label:'PENDIENTE',cls:'pending'};let allowedUnit=NaN,allowedTotal=NaN;
    if(s.exempt)outcome={code:'gray',label:STATUS.gray,cls:'gray',reason:'Caso tributario especial / inafecto: requiere validación específica.'};
    else if(rule.kind==='zone_gray')outcome={code:'gray',label:STATUS.gray,cls:'gray',reason:rule.detail||rule.message};
    else if(rule.kind==='input_needed')outcome={code:'pending',label:'FALTA DATO',cls:'pending',reason:rule.detail||rule.message};
    else if(['contractual','operational_validated'].includes(rule.kind)&&Number.isFinite(rule.allowed)){
      if(!(Number.isFinite(s.totalMv)&&s.quantity>0))outcome={code:'pending',label:'INGRESE TOTAL MV',cls:'pending'};
      else if(rule.basisNative!=='mv'&&!basis.basis)outcome={code:'pending',label:'CONFIRMAR UNIDAD',cls:'pending',reason:'La escala MV ↔ Kairos es ambigua.'};
      else{allowedUnit=allowedForBasis(rule,basis.basis,s);allowedTotal=allowedUnit*s.quantity;outcome=classify(s.totalMv,allowedTotal);}
    }
    const diff=Number.isFinite(allowedTotal)&&Number.isFinite(s.totalMv)?round2(s.totalMv-allowedTotal):NaN;const diffPct=Number.isFinite(diff)&&allowedTotal>0?(diff/allowedTotal)*100:NaN;
    const opportunity=outcome.code==='under'&&Number.isFinite(diff)?Math.abs(diff):0;const overvaluation=outcome.code==='over'&&Number.isFinite(diff)?Math.abs(diff):0;
    return {s,rule,basis,mvUnit,outcome,allowedUnit,allowedTotal,diff,diffPct,opportunity,overvaluation};}
  function setText(id,v){if(el(id))el(id).textContent=v;}
  function setStatus(out){const node=el('khStatus');if(!node)return;node.textContent=out.label;node.className=`kh-status ${out.cls||'pending'}`;}
  function renderDiagnostic(r){const box=el('khUnitDiagnostic');if(!box)return;const s=r.s,b=r.basis;if(s.units<=1){box.className='kh-unit-diagnostic ok';box.innerHTML='<b>Unidad homologada.</b> La presentación contiene una sola unidad.';return;}if(s.basis==='inner'||s.basis==='presentation'){box.className='kh-unit-diagnostic ok';box.innerHTML=`<b>Base confirmada manualmente:</b> ${s.basis==='presentation'?`${s.labels.pack} completa x ${s.units}`:s.labels.inner}.`;return;}const d=detectBasis(s);if(d.confidence==='high'){box.className='kh-unit-diagnostic ok';box.innerHTML=`<b>Detección automática:</b> el precio MV es consistente con ${d.basis==='presentation'?`${s.labels.pack} completa x ${s.units}`:s.labels.inner}.`;return;}if(Number.isFinite(s.totalMv)){box.className='kh-unit-diagnostic warn';box.innerHTML='<b>Unidad ambigua.</b> Confirma manualmente si MV liquida por unidad interna o por presentación completa antes de interpretar la diferencia.';return;}box.className='kh-unit-diagnostic neutral';box.textContent='Completa Total MV para detectar la equivalencia de unidad.';}
  function breakdown(r){const s=r.s,rule=r.rule;let rows=[];if(rule.kind==='contractual'||rule.kind==='operational_validated'){
      if(rule.ppsReference)rows.push(['PVF × 1.33',money(rule.ppsReference)]);if(Number.isFinite(rule.sourceUnit))rows.push(['Referencia por unidad interna',money(rule.sourceUnit)]);if(Number.isFinite(rule.noIgv))rows.push(['Base sin IGV',money(rule.noIgv)]);const c=COMPANIES[s.insurer];if(c&&rule.method!=='Precio de compra +5%')rows.push(['Descuento aplicado',`${Math.round(c.discount*100)}%`]);if(Number.isFinite(r.allowedUnit))rows.push(['Precio convenio / validado por unidad MV',money(r.allowedUnit)]);if(Number.isFinite(r.allowedTotal))rows.push(['Total convenio / validado',money(r.allowedTotal)]);if(Number.isFinite(s.totalMv))rows.push(['Total MV',money(s.totalMv)]);if(Number.isFinite(r.diff))rows.push(['Diferencia MV - convenio',`${r.diff>=0?'+':''}${money(r.diff).replace('S/ ','S/ ')}`]);}
    if(!rows.length)return rule.detail||rule.message||'Sin cálculo disponible.';return rows.map(([a,b])=>`<div><span>${a}</span><strong>${b}</strong></div>`).join('');}
  function render(){const r=calculate();khLast=r;const {s,rule,basis,outcome}=r;const c=COMPANIES[s.insurer];if(s.insurer||s.medication||s.presentation){setText('khStep2Context',`${c?.name||'IAFA pendiente'} · ${s.medication||'Medicamento pendiente'} · ${s.presentation||'Presentación pendiente'}`);setText('khResultContext',`${c?.name||'IAFA'} · ${s.medication||'Medicamento'} · ${s.presentation||'Presentación'}`);}setStatus(outcome);setText('khAllowedUnit',money(r.allowedUnit));setText('khAllowedTotal',money(r.allowedTotal));setText('khMvTotal',money(s.totalMv));setText('khDifference',money(Number.isFinite(r.diff)?Math.abs(r.diff):0));setText('khDifferencePct',Number.isFinite(r.diffPct)?`${r.diffPct>0?'+':''}${pct(r.diffPct)}`:'0.00%');setText('khOpportunity',money(r.opportunity));setText('khOvervaluation',money(r.overvaluation));setText('khMethod',rule.method||'-');setText('khValidation',rule.validation||'-');setText('khMethodNote',rule.detail||rule.message||'La regla utilizada aparecerá aquí.');setText('khBasisLabel',rule.basisNative==='mv'?'Unidad MV':(basis.basis==='presentation'?`${s.labels.pack} completa x ${s.units}`:(basis.basis==='inner'?s.labels.inner:'Base pendiente')));const intro=outcome.reason||({adequate:'El precio MV se encuentra dentro del rango permitido.',under:'El total MV está más de 5% por debajo del valor de convenio. Existe una oportunidad económica a revisar.',over:'El total MV está por encima del máximo permitido por la regla aplicada.',gray:'No existe una regla automática suficiente para cerrar el caso.'}[outcome.code]||'Completa los datos requeridos para obtener la clasificación.');setText('khResultIntro',intro);if(el('khCalcBreakdown'))el('khCalcBreakdown').innerHTML=breakdown(r);renderDiagnostic(r);if(el('khRimacFallback'))el('khRimacFallback').hidden=!(s.insurer==='rimac'&&!(Number.isFinite(s.pps)&&s.pps>0)&&!(Number.isFinite(s.pvf)&&s.pvf>0));renderMonthly();}
  function khMessage(message,type='info'){
    const box=el('khStepMessage'); if(!box)return;
    if(!message){box.hidden=true;box.textContent='';box.className='kh-step-message';return;}
    box.hidden=false;box.textContent=message;box.className=`kh-step-message ${type}`;
  }
  function updateFlow(){
    [1,2,3].forEach(n=>{
      const b=el(`khFlow${n}`); if(!b)return;
      b.classList.toggle('active',n===khStep);
      b.classList.toggle('done',n<khStep||n<khMaxStep);
      b.classList.toggle('locked',n>khMaxStep);
      b.setAttribute('aria-current',n===khStep?'step':'false');
      b.setAttribute('aria-disabled',n>khMaxStep?'true':'false');
    });
  }
  function showStep(step,scroll=true){
    step=Math.max(1,Math.min(3,Number(step)||1));
    if(step>khMaxStep){khMessage(step===2?'Completa primero los Datos Kairos y presiona Continuar.':'Completa los Datos MV y presiona Calcular resultado.','warn');return false;}
    khStep=step;
    [1,2,3].forEach(n=>{const p=el(`khStep${n}`);if(p){p.hidden=n!==step;p.classList.toggle('show',n===step);}});
    updateFlow();khMessage('');
    if(scroll){const page=el('kairos');page?.scrollIntoView({behavior:'smooth',block:'start'});}
    return true;
  }
  function validateStep1(){
    const s=getState(),missing=[];
    if(!s.insurer)missing.push('IAFA');
    if(!s.medication)missing.push('medicamento');
    if(!s.presentation)missing.push('presentación Kairos');
    if(!(s.units>0))missing.push('unidades por presentación');
    if(missing.length)return {ok:false,message:`Completa antes de continuar: ${missing.join(', ')}.`};
    return {ok:true};
  }
  function validateStep2(){
    const r=calculate(),s=r.s;
    if(!(s.quantity>0))return {ok:false,message:'Ingresa una cantidad liquidada mayor que cero.'};
    if(!Number.isFinite(s.totalMv))return {ok:false,message:'Ingresa el Total MV para poder comparar.'};
    if(s.insurer==='rimac'&&!(Number.isFinite(s.pps)&&s.pps>0)&&!(Number.isFinite(s.pvf)&&s.pvf>0)&&!(Number.isFinite(s.purchase)&&s.purchase>0))return {ok:false,message:'Para Rímac, sin PPS ni PVF, ingresa el precio de compra sin IGV.'};
    if(!s.exempt&&['contractual','operational_validated'].includes(r.rule.kind)&&r.rule.basisNative!=='mv'&&s.units>1&&!r.basis.basis)return {ok:false,message:'La unidad MV ↔ Kairos es ambigua. Confirma si MV liquida por unidad interna o por presentación completa.'};
    return {ok:true};
  }
  window.khGoStep=function(step){
    step=Number(step)||1;
    if(step===2&&khMaxStep<2){window.khContinueToMv();return;}
    if(step===3&&khMaxStep<3){khMessage('Primero completa los Datos MV y presiona Calcular resultado.','warn');return;}
    showStep(step);
  };
  window.khContinueToMv=function(){
    const v=validateStep1();if(!v.ok){khMessage(v.message,'warn');return;}
    khMaxStep=Math.max(khMaxStep,2);render();
    const s=getState(),c=COMPANIES[s.insurer];setText('khStep2Context',`${c?.name||'IAFA'} · ${s.medication} · ${s.presentation}`);
    showStep(2);
  };
  window.khFinishCalculation=function(){
    const v1=validateStep1();if(!v1.ok){khMaxStep=Math.max(khMaxStep,1);showStep(1);khMessage(v1.message,'warn');return;}
    const v2=validateStep2();if(!v2.ok){khMessage(v2.message,'warn');return;}
    render();const r=khLast||calculate();
    if(!['adequate','gray','under','over'].includes(r.outcome.code)){khMessage(r.outcome.reason||r.rule.detail||r.rule.message||'Falta información para generar un resultado final.','warn');return;}
    khMaxStep=3;const c=COMPANIES[r.s.insurer];setText('khResultContext',`${c?.name||'IAFA'} · ${r.s.medication} · ${r.s.presentation}`);showStep(3);
  };
  window.khInit=function(){render();showStep(khStep,false);};
  window.khCalculate=function(){render();};
  window.khPresentationChanged=function(){const labels=unitLabels(el('khPresentation')?.value||'');if(el('khUnits'))el('khUnits').value=labels.units;setText('khUnitHint',`${labels.units} ${labels.units===1?'unidad detectada':'unidades detectadas'}`);render();};
  window.khReset=function(){['khInsurer','khMedication','khPresentation','khPvf','khPps','khTotalMv','khPurchase','khAccount','khProfat'].forEach(id=>{if(el(id))el(id).value='';});if(el('khUnits'))el('khUnits').value='1';if(el('khQuantity'))el('khQuantity').value='1';if(el('khBasis'))el('khBasis').value='auto';if(el('khExempt'))el('khExempt').checked=false;setText('khUnitHint','1 unidad detectada');setText('khStep2Context','Consulta cargada');setText('khResultContext','Consulta calculada');khStep=1;khMaxStep=1;khMessage('');render();showStep(1);};
  function monthKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
  function readRecords(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')||[];}catch(e){return [];}}
  function saveRecords(rows){localStorage.setItem(STORAGE_KEY,JSON.stringify(rows));}
  function currentRecord(){const r=khLast||calculate(),s=r.s;if(!['adequate','gray','under','over'].includes(r.outcome.code))return null;const account=text(el('khAccount')?.value),profat=text(el('khProfat')?.value);if(!account)return null;const now=new Date(),key=[monthKey(),account,s.insurer,profat.toLowerCase(),s.medication.toLowerCase(),s.presentation.toLowerCase()].join('|');return {recordKey:key,registeredAt:now.toISOString(),month:monthKey(),accountNumber:account,profatCode:profat,insurerId:s.insurer,insurer:COMPANIES[s.insurer]?.name||'',medication:s.medication,presentation:s.presentation,pvf:Number.isFinite(s.pvf)?round2(s.pvf):null,pps:Number.isFinite(s.pps)?round2(s.pps):null,unitsPerPresentation:s.units,mvBasis:r.basis.basis||'',quantity:s.quantity,mvUnitPrice:Number.isFinite(r.mvUnit)?round2(r.mvUnit):null,mvTotal:Number.isFinite(s.totalMv)?round2(s.totalMv):null,priceConventionUnit:Number.isFinite(r.allowedUnit)?round2(r.allowedUnit):null,priceConventionTotal:Number.isFinite(r.allowedTotal)?round2(r.allowedTotal):null,signedDifference:Number.isFinite(r.diff)?round2(r.diff):null,differenceAbsolute:Number.isFinite(r.diff)?Math.abs(round2(r.diff)):null,differencePct:Number.isFinite(r.diffPct)?r.diffPct:null,opportunityLoss:r.opportunity||0,overvaluation:r.overvaluation||0,statusCode:r.outcome.code,status:r.outcome.label,method:r.rule.method||'',contractual:r.rule.kind==='contractual',operationallyValidated:r.rule.kind==='operational_validated',validationSource:r.rule.validation||'',source:'Kairos Perú · ingreso manual en Hub'};}
  window.khRegister=function(){const msg=el('khRegisterMessage');const rec=currentRecord();if(!rec){if(msg)msg.textContent='Completa el número de cuenta y genera un resultado final antes de registrar.';return;}const rows=readRecords(),i=rows.findIndex(x=>x.recordKey===rec.recordKey);if(i>=0){rec.registeredAt=rows[i].registeredAt;rec.updatedAt=new Date().toISOString();rows[i]=rec;}else rows.push(rec);saveRecords(rows);if(msg)msg.textContent=i>=0?'Registro actualizado.':'Resultado registrado correctamente.';renderMonthly();};
  function renderMonthly(){const box=el('khMonthlySummary');if(!box)return;const rows=readRecords().filter(r=>r.month===monthKey());const count=c=>rows.filter(r=>r.statusCode===c).length;const sum=f=>rows.reduce((a,r)=>a+(Number(r[f])||0),0);box.innerHTML=`<div><span>Registros</span><strong>${rows.length}</strong></div><div><span>Precio adecuado</span><strong>${count('adequate')}</strong></div><div><span>Zona gris</span><strong>${count('gray')}</strong></div><div><span>Por debajo — escalar</span><strong>${count('under')}</strong></div><div><span>Sobrevaloración</span><strong>${count('over')}</strong></div><div><span>Oportunidad económica</span><strong>${money(sum('opportunityLoss'))}</strong></div>`;}
  function csvEscape(v){const s=String(v??'').replace(/\r?\n/g,' ');return `"${s.replace(/"/g,'""')}"`;}
  window.khExportCsv=function(){const rows=readRecords().filter(r=>r.month===monthKey());if(!rows.length){const msg=el('khRegisterMessage');if(msg)msg.textContent='No hay registros del mes para exportar.';return;}const headers=['Mes','Fecha','Cuenta','IAFA','Código PROFAT','Medicamento','Presentación','Cantidad','Total MV','Precio convenio/validado total','Diferencia S/','Diferencia %','Estado','Método','Contractual','Validado operativamente','Fuente validación','Oportunidad económica','Sobrevaloración'];const vals=rows.map(r=>[r.month,r.registeredAt,r.accountNumber,r.insurer,r.profatCode,r.medication,r.presentation,r.quantity,r.mvTotal,r.priceConventionTotal,r.signedDifference,r.differencePct,r.status,r.method,r.contractual,r.operationallyValidated,r.validationSource,r.opportunityLoss,r.overvaluation]);const csv='\ufeff'+[headers,...vals].map(row=>row.map(csvEscape).join(';')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`kairos_reporte_${monthKey()}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  window.khCopyResult=function(){const r=khLast||calculate(),s=r.s;const lines=[`Calculadora Kairos · ${COMPANIES[s.insurer]?.name||'IAFA no seleccionada'}`,`Medicamento: ${s.medication||'-'}`,`Presentación: ${s.presentation||'-'}`,`Estado: ${r.outcome.label}`,`Método: ${r.rule.method||'-'}`,`Precio convenio/validado por unidad MV: ${money(r.allowedUnit)}`,`Total convenio/validado: ${money(r.allowedTotal)}`,`Total MV: ${money(s.totalMv)}`,`Diferencia: ${money(Number.isFinite(r.diff)?Math.abs(r.diff):0)} ${Number.isFinite(r.diffPct)?`(${r.diffPct>0?'+':''}${pct(r.diffPct)})`:''}`,`Oportunidad económica: ${money(r.opportunity)}`,`Sobrevaloración: ${money(r.overvaluation)}`];navigator.clipboard?.writeText(lines.join('\n')).then(()=>{const b=document.querySelector('.kh-copy-btn');if(b){const old=b.textContent;b.textContent='Copiado ✓';setTimeout(()=>b.textContent=old,1200);}}).catch(()=>{});};
})();
