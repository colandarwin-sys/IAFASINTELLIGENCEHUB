/* IAFAS Intelligence Hub v4.2 - Decision Engine overrides */
(function(){
  const $id = (id)=>document.getElementById(id);
  const clean = (s)=>String(s||'').replace(/\s+/g,' ').trim();
  const esc2 = (s)=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm = (s)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const stop = new Set(['como','cuando','donde','para','porque','sobre','segun','cual','cuales','tiene','debe','deben','esta','este','estos','estas','peas','plan','esencial','aseguramiento','salud','persona','paciente','pacientes','hacer','puede','pueden','incluye','cubierto','cobertura','cubre','diagnostico','diagnosticos','procedimiento','procedimientos','atencion','medico','medicos','medica','medicas','manual','manuales','dicen','acerca','relacionado','relacionados','relacionada','relacionadas','vinculado','vinculados','asociado','asociados','esta','estan','una','uno','los','las','del','con','sin','por','que','es','en','al','el','la']);
  const tokens = (q)=>norm(q).match(/[a-z0-9.]{2,}/g)?.filter(w=>!stop.has(w))||[];
  const pdf = (page)=>'static/docs/peas.pdf#page='+(page||1);
  const manualPdf = (page)=>'static/docs/manual-normas-facturacion.pdf#page='+(page||1);

  function textScore(text, q){
    const base = norm(text); const phrase = norm(q); const tk = tokens(q); let score = 0;
    if(phrase && base.includes(phrase)) score += 180;
    tk.forEach(t=>{ const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'); const hits=(base.match(re)||[]).length; score += Math.min(hits,12)*18; if(base.startsWith(t)) score+=20; });
    return score;
  }
  function specificTermBoost(text,q){
    const base=norm(text), nq=norm(q);
    let score=0;
    tokens(q).forEach(t=>{ if(t.length>=8 && base.includes(t)) score+=240; else if(t.length>=6 && base.includes(t)) score+=80; });
    ['instrumentista','anestesiolog','ayudante','cirujano','honorario','honorarios','quirurg','factur','cobro','cobrara','recargo','nocturn','feriad','turno','paga','pago','porcentaje','adicional','tarifa'].forEach(t=>{ if(nq.includes(t) && base.includes(t)) score+=220; });
    return score;
  }
  function titleTermBoost(title,q){
    const base=norm(title);
    let score=0;
    tokens(q).forEach(t=>{ if(t.length>=6 && base.includes(t)) score+=520; });
    return score;
  }
  function conditionKey(s){return norm(s).replace(/\s+/g,' ').trim();}
  function proceduresForCondition(title){
    const k=conditionKey(title);
    return (window.peasProcedures||[]).filter(p=>conditionKey(p.condition)===k);
  }
  function conditionSearchText(c){
    const procs=proceduresForCondition(c.title).slice(0,260);
    return [c.title,c.definition,(c.cie10||[]).join(' '),c.chapter,procs.map(p=>[p.code,p.denomination,p.context].join(' ')).join(' ')].join(' ');
  }
  function conditionMatches(q, limit=8){
    const conds=(window.peasConditions||[]);
    if(!q) return [];
    const procBoost=new Map();
    (window.peasProcedures||[]).forEach(p=>{
      const sc=textScore([p.condition,p.code,p.denomination,p.context].join(' '),q);
      if(sc>0){ const k=conditionKey(p.condition); procBoost.set(k,(procBoost.get(k)||0)+Math.min(sc,140)); }
    });
    return conds.map(c=>{
      let sc=textScore(conditionSearchText(c),q)+(procBoost.get(conditionKey(c.title))||0);
      const nq=norm(q), nt=norm(c.title);
      if(nq && nt.includes(nq)) sc+=350;
      (c.cie10||[]).forEach(dx=>{ const nd=norm(dx); tokens(q).forEach(t=>{ if(nd.startsWith(t)||nd.includes(' '+t)) sc+=150; }); });
      return {...c,_score:sc};
    }).filter(c=>c._score>0).sort((a,b)=>b._score-a._score||a.page-b.page).slice(0,limit);
  }
  function classifyProc(p){
    const lines=String(p.context||'').split(/\n+/).map(clean).filter(Boolean);
    const hdr=new Set(['Código del','procedimiento','Denominación de','Procedimientos','Código del procedimiento','Denominación de Procedimientos','Procedimientos médicos y sanitarios']);
    const idx=lines.findIndex(l=>l===String(p.code));
    let pre=idx>0?lines.slice(Math.max(0,idx-8),idx).filter(l=>!hdr.has(l)):[];
    const interventions=['Promoción','Prevención','Diagnóstico','Tratamiento','Recuperación','Rehabilitación','Paliativo'];
    let inter='No especificado'; let prest='Prestación PEAS';
    for(let i=pre.length-1;i>=0;i--){ if(interventions.some(x=>norm(pre[i])===norm(x))){ inter=pre[i]; prest=pre.slice(i+1).join(' ')||prest; break; } }
    if(inter==='No especificado' && pre.length){ prest=pre.join(' '); }
    let details=clean(p.context||'');
    const den=clean(p.denomination||'');
    if(den && details.includes(den)) details=clean(details.slice(details.indexOf(den)+den.length));
    details=details.replace(/^[-\s]+/,'');
    return {intervention:inter, prestation:prest, support:details||'Revisar sustento y precisiones en la página fuente del PEAS.'};
  }
  function groupProcedures(rows){
    const map=new Map();
    rows.forEach(p=>{const c=classifyProc(p); const k=c.intervention||'No especificado'; if(!map.has(k)) map.set(k,[]); map.get(k).push({...p,_class:c});});
    return Array.from(map.entries()).map(([inter,items])=>({inter,items}));
  }
  function quickCategories(rows){
    const cats=[
      ['Consulta / evaluación',/consulta|evaluaci[oó]n|manejo|interconsulta/i],
      ['Laboratorio',/hemograma|glucosa|orina|dosaje|prueba|perfil|laboratorio|recuento|an[aá]lisis|anticuerpo|ant[ií]geno/i],
      ['Imágenes',/ecograf|radiolog|radiograf|tomograf|resonancia|rayos|t[oó]rax|imagen/i],
      ['Procedimiento / cirugía',/quir[uú]rg|cirug|lapar|apendic|procedimiento|drenaje|extracci[oó]n|sutura/i],
      ['Medicamentos / tratamiento',/administraci[oó]n|tratamiento|vacuna|inmunoglobulina|terapia|medicamento/i],
      ['Telemedicina',/teleconsulta|teleorientaci[oó]n|telemonitoreo|teleinterconsulta|telemedicina/i]
    ];
    return cats.map(([name,re])=>({name,count:rows.filter(p=>re.test([p.denomination,p.context].join(' '))).length})).filter(x=>x.count>0);
  }
  function shortDefinition(c){return clean(c.definition||'El PEAS registra esta condición asegurable. Revisar diagnósticos CIE-10 y prestaciones asociadas para la decisión operativa.');}
  function renderCie(c){
    const cie=(c.cie10||[]);
    if(!cie.length) return '<div class="muted-note">No se identificaron diagnósticos CIE-10 en la extracción automática. Validar página fuente.</div>';
    return `<div class="cie-grid">${cie.map(dx=>{const parts=clean(dx).split(' '); const code=parts.shift()||''; return `<div class="cie-chip"><b>${esc2(code)}</b><span>${esc2(parts.join(' '))}</span></div>`;}).join('')}</div>`;
  }
  function procTable(rows){
    if(!rows.length) return '<div class="empty-state">No se encontraron filas tabulares relacionadas. Abrir la página fuente para validar el contenido completo.</div>';
    const groups=groupProcedures(rows);
    return `<div class="decision-table-wrap">${groups.map(g=>`<details class="proc-group" open><summary><span>${esc2(g.inter)}</span><b>${g.items.length} prestaciones</b></summary><div class="proc-table-scroll"><table class="decision-table"><thead><tr><th>Prestación</th><th>Código</th><th>Procedimiento médico / sanitario</th><th>Sustento técnico / precisiones</th><th>Fuente</th></tr></thead><tbody>${g.items.map(p=>`<tr><td>${esc2(p._class.prestation)}</td><td><b>${esc2(p.code)}</b></td><td>${esc2(p.denomination)}</td><td>${esc2(p._class.support.slice(0,360))}${p._class.support.length>360?'...':''}</td><td><a href="${pdf(p.page)}" target="_blank" rel="noopener">p. ${p.page}</a></td></tr>`).join('')}</tbody></table></div></details>`).join('')}</div>`;
  }
  function ensurePeasShell(){
    const sec=$id('peas'); if(!sec || sec.dataset.v42==='1') return; sec.dataset.v42='1';
    sec.innerHTML=`
      <div class="topbar search-topbar"><div class="titleblock"><div class="section-label">PEAS Intelligence</div><h2>Buscador por condición asegurable</h2><p>Busca por diagnóstico, CIE-10, procedimiento o pregunta. El resultado prioriza definición, diagnósticos relacionados y prestaciones del Capítulo 3 del PEAS.</p></div><div class="toolbar"><span id="peasCount" class="pill blue">0 resultados</span><a class="pill action-pill" href="static/docs/peas.pdf" target="_blank" rel="noopener">Abrir PDF completo</a></div></div>
      <div class="panel decision-search"><div><span>Consulta clínica-administrativa</span><div class="manual-query-row"><input id="peas_q" class="search main-search" placeholder="Ejemplo: apendicitis, K35, diabetes, recién nacido sano, ¿está cubierto parto normal?" onkeydown="if(event.key==='Enter')renderPeas()"><button class="pill blue action-pill" onclick="renderPeas()">Buscar</button></div></div><button class="pill action-pill" onclick="clearPeasSearch()">Limpiar</button></div>
      <div id="peasAnswer" class="peas-decision-output"><div class="empty-state">Escribe un diagnóstico, CIE-10 o pregunta para obtener una decisión rápida sustentada en el PEAS.</div></div>
      <div id="peasAlternatives" class="peas-alternatives"></div>`;
  }
  window.clearPeasSearch=function(){ensurePeasShell(); const q=$id('peas_q'); if(q)q.value=''; const a=$id('peasAnswer'); const alt=$id('peasAlternatives'); if($id('peasCount'))$id('peasCount').innerText='0 resultados'; if(a)a.innerHTML='<div class="empty-state">Escribe un diagnóstico, CIE-10 o pregunta para obtener una decisión rápida sustentada en el PEAS.</div>'; if(alt)alt.innerHTML='';};
  window.renderPeas=function(){
    ensurePeasShell(); const q=clean($id('peas_q')?.value||''); const ans=$id('peasAnswer'), alt=$id('peasAlternatives');
    if(!q){window.clearPeasSearch(); return;}
    const matches=conditionMatches(q,8); if($id('peasCount'))$id('peasCount').innerText=matches.length+' condiciones';
    if(!matches.length){ans.innerHTML='<div class="empty-state">No se encontró una condición asegurable vinculada. Prueba con un diagnóstico más específico, un CIE-10 o menos palabras.</div>'; alt.innerHTML=''; return;}
    const c=matches[0]; const rows=proceduresForCondition(c.title); const cats=quickCategories(rows);
    ans.innerHTML=`<div class="decision-header-card panel"><div><span class="section-label">Condición asegurable encontrada</span><h3>${esc2(c.title)}</h3><p>${esc2(c.chapter)} · páginas ${esc2(c.page)}${c.endPage?' - '+esc2(c.endPage):''}</p></div><div class="coverage-verdict"><span>Decisión rápida</span><strong>Incluida en PEAS</strong><small>Validar precisiones y sustento técnico.</small></div></div>
    <div class="peas-decision-grid"><section class="panel decision-main"><div class="decision-block blue"><b>1. Definición oficial</b><p>${esc2(shortDefinition(c))}</p></div><div class="decision-block slate"><b>2. Diagnósticos CIE-10 relacionados</b>${renderCie(c)}</div><div class="decision-block green"><b>3. Lectura rápida de prestaciones</b><div class="category-strip">${cats.length?cats.map(x=>`<span><b>${x.count}</b>${esc2(x.name)}</span>`).join(''):'<span><b>'+rows.length+'</b>Prestaciones registradas</span>'}</div><p class="muted-note">La tabla inferior reorganiza el contenido del literal c) Contenido de las condiciones asegurables para facilitar la decisión operativa.</p></div><div class="manual-citation"><b>Fuente:</b> PEAS · Capítulo 3 · ${esc2(c.chapter)} · p. ${esc2(c.page)} <a href="${pdf(c.page)}" target="_blank" rel="noopener">Abrir página</a></div></section><aside class="panel decision-side"><h3>Resumen ejecutivo</h3><div class="mini-metric"><span>Condición</span><b>${esc2(c.title)}</b></div><div class="mini-metric"><span>CIE-10</span><b>${(c.cie10||[]).length||'No extraído'}</b></div><div class="mini-metric"><span>Prestaciones</span><b>${rows.length}</b></div><div class="mini-metric"><span>Página inicial</span><b>${esc2(c.page)}</b></div></aside></div>
    <section class="panel peas-table-panel"><div class="panel-head"><div><h3>Tabla de intervención, prestaciones y procedimientos</h3><p>Información relacionada al literal c) Contenido de las condiciones asegurables.</p></div><span class="pill blue">${rows.length} filas</span></div>${procTable(rows)}</section>`;
    alt.innerHTML=matches.length>1?`<div class="panel alternatives-panel"><div class="panel-head"><div><h3>Otras condiciones posibles</h3><p>Úsalas si la búsqueda no corresponde al primer resultado.</p></div></div><div class="alt-list">${matches.slice(1).map((m,idx)=>`<button onclick="document.getElementById('peas_q').value='${esc2(m.title).replace(/'/g,'&#039;')}';renderPeas();"><b>${esc2(m.title)}</b><span>${esc2(m.chapter)} · p. ${esc2(m.page)}</span></button>`).join('')}</div></div>`:'';
  };

  function ensureIntelShell(){
    const ans=$id('intelAnswer'), res=$id('intelResults'); if(!ans||!res) return;
  }
  function buildManualHits(q,limit=5){
    try{ return (window.manualRecords||manualRecords||[]).filter(r=>typeof manualAllowedForSearch==='function'?manualAllowedForSearch(r):true).map(r=>{const body=typeof manualBody==='function'?manualBody(r):(r.text||r.body||''); const title=typeof manualTitle==='function'?manualTitle(r):(r.title||r.heading||'Manual'); const kind=typeof manualKind==='function'?manualKind(r):(r.kind||'Manual'); const searchText=[title,kind,body,r.keywords].join(' '); const sc=textScore(searchText,q)+specificTermBoost(searchText,q)+titleTermBoost(title,q); return {...r,_title:title,_kind:kind,_body:body,_score:sc};}).filter(r=>r._score>0).sort((a,b)=>b._score-a._score).slice(0,limit); }catch(e){return [];} }
  function buildListaHits(q,limit=5){
    try{ return (window.data||data||[]).map(r=>{const sc=textScore([r.ID,r.LISTA,r['TECNOLOGÍA'],r['COBERTURA'],r['CONDICIONES / EXCEPCIONES'],r['PALABRAS CLAVE']].join(' '),q); return {...r,_score:sc};}).filter(r=>r._score>0).sort((a,b)=>b._score-a._score).slice(0,limit); }catch(e){return [];} }
  function oncologyIntent(q){return /\b(oncol|cancer|tumor|neoplas|quimio|radioterap|pet\s*scan|anatomia\s*patologica)/.test(norm(q));}
  function capRecordUrl(r){
    const hasCustom=Object.prototype.hasOwnProperty.call(r||{},'pdf');
    const base=hasCustom?r.pdf:'static/docs/capacitacion-lineamientos-convenios-2026.pdf';
    if(!base)return '';
    const page=r.pagelink||String(r.pagina||'').split(' ')[0];
    return page?`${base}#page=${page}`:base;
  }
  function buildCapHits(q,limit=4){
    try{
      const base=(window.CAPACITACIONES_QA&&window.CAPACITACIONES_QA.length)?window.CAPACITACIONES_QA:(window.CAPACITACIONES||[]);
      if(oncologyIntent(q))return base.filter(r=>r.id==='QA-009').map(r=>({...r,_score:100000}));
      return base.map(r=>{
        const question=r.pregunta||r.tema||'';
        const aliases=String(r.aliases||'').split('|').filter(Boolean);
        const searchText=[question,r.respuesta,r.accion,r.revisar,r.alerta,r.grupo,r.keywords,r.tema,r.resumen,r.requisitos,...aliases].filter(Boolean).join(' ');
        let sc=textScore(searchText,q)+titleTermBoost(question,q)+specificTermBoost(searchText,q);
        const nq=norm(q).replace(/[¿?¡!.,;:]+/g,' ').replace(/\s+/g,' ').trim();
        const nqCompact=nq.replace(/\b(que|qué|es|un|una|el|la|los|las|de|del|para|por|cuanto|cuánto|cuantos|cuántos|cuanta|cuánta|cuantas|cuántas)\b/g,' ').replace(/\s+/g,' ').trim();
        [question,...aliases].forEach(a=>{
          const na=norm(a).replace(/[¿?¡!.,;:]+/g,' ').replace(/\s+/g,' ').trim();
          const naCompact=na.replace(/\b(que|es|un|una|el|la|los|las|de|del|para|por|cuanto|cuantos|cuanta|cuantas)\b/g,' ').replace(/\s+/g,' ').trim();
          if(nq && na===nq) sc+=5000;
          else if(nqCompact && naCompact && (naCompact.includes(nqCompact)||nqCompact.includes(naCompact))) sc+=2200;
        });
        return {...r,_score:sc};
      }).filter(r=>r._score>0).sort((a,b)=>b._score-a._score).slice(0,limit);
    }catch(e){return [];}
  }
  function buildExclusionHits(q,limit=6){
    try{
      return (window.EXCLUSIONES_IAFAS||[]).map(r=>{
        const text=[r.id,r.tipo,r.grupo,r.iafas,r.resumen,r.regla,r.keywords].join(' ');
        const sc=textScore(text,q)+specificTermBoost(text,q)+titleTermBoost(r.grupo,q);
        return {...r,_score:sc};
      }).filter(r=>r._score>0).sort((a,b)=>b._score-a._score).slice(0,limit);
    }catch(e){return [];}
  }
  function activeSource(){
    return btn?.dataset?.intelSource||'ALL';
  }
  function sourceAllowed(src){
    const active=activeSource();
    return active==='ALL'||active===src;
  }
  function manualIntent(q){
    return /honorari|factur|manual|manuales|norma|cobro|cobr|instrumentista|ayudante|anestesiolog|quirurg|cirujano|obstetriz|obstetra|habitaci|interconsulta|farmacia|alta|auditor|emergenc|sala|reposo|clinica|cl[ií]nica|gasto|tarifa|recargo|nocturn|feriad|turno|paga|pago|porcentaje|adicional|adicion|fallec|ingreso|egreso|estancia|hora|horas|injerto|oseo|cardiolog|intervencionista|\buci\b|cuidados intensivos|unidad de cuidados intensivos|quemad|epicrisis/.test(norm(q));
  }
  function peasIntent(q){
    return /(^|\s)(peas|cie|cie-10|diagnost|dx|apendic|diabetes|hipertension|recien nacido|condicion asegurable|tamizaje|parto|embarazo|neonato|cancer|vih|sida|malaria|tuberculosis)(\s|$)/.test(norm(q));
  }
  function sourceQuote(m){
    if(!m) return '';
    if(m._body) return clean(m._body);
    if(m.ID) return clean([m['COBERTURA'],m['CONDICIONES / EXCEPCIONES']].filter(Boolean).join(' '));
    if(m.resumen) return clean([m.resumen,m.requisitos,m.alertas].filter(Boolean).join(' '));
    return 'Fuente relacionada disponible en el Hub.';
  }
  function sourceDoc(m){
    if(!m) return 'Fuente documental';
    if(m._title) return `Manual de Normas · p. ${esc2(m.page||'-')}`;
    if(m.ID) return `Listas AB · ${esc2(m.ID)} · Lista ${esc2(m.LISTA)}`;
    return `Capacitaciones IAFAS · ${esc2(m.iafas||'')}`;
  }
  function sourceCards(peas,manual,listas,caps,exclusiones,q){
    const manualMode=manualIntent(q);
    const manualBoost=manualMode?900:0;
    const cards=[];
    if(sourceAllowed('PEAS') && (!manualMode || !manual.length)) peas.forEach(c=>cards.push({type:'PEAS',label:'PEAS',title:c.title,text:shortDefinition(c),doc:`PEAS · p. ${c.page} · ${(c.cie10||[]).length} CIE-10`,url:pdf(c.page),score:c._score}));
    if(sourceAllowed('MANUAL')) manual.forEach(r=>cards.push({type:'MANUAL',label:'Manual',title:r._title,text:clean(r._body),doc:`Manual de Normas · p. ${r.page||'-'}`,url:manualPdf(r.page),score:r._score+manualBoost}));
    if(sourceAllowed('LISTAS')) listas.forEach(r=>cards.push({type:'LISTAS',label:'Listas AB',title:r['TECNOLOGÍA'],text:clean([r['COBERTURA'],r['CONDICIONES / EXCEPCIONES']].filter(Boolean).join(' ')),doc:`${r.ID} · Lista ${r.LISTA}`,score:r._score}));
    if(sourceAllowed('EXC')) exclusiones.forEach(r=>cards.push({type:'EXC',label:'Exclusiones IAFAS',title:r.grupo,text:clean([r.resumen,r.regla].filter(Boolean).join(' ')),doc:`${r.tipo} · ${r.iafas}`,score:r._score+700}));
    if(sourceAllowed('CAP')) caps.forEach(r=>cards.push({type:'CAP',label:'Capacitación',title:r.pregunta||r.tema||'Capacitación',text:clean(r.respuesta||r.resumen||''),doc:r.fuente?`${r.fuente}${r.pagina?' · p. '+r.pagina:''}`:`${r.iafas||'Capacitación'} · ${r.categoria||r.grupo||''}`,url:capRecordUrl(r),score:r._score}));
    return cards.sort((a,b)=>b.score-a.score).slice(0,12);
  }
  function cardHtml(card){
    const button=card.url?`<a class="doc-button" href="${card.url}" target="_blank" rel="noopener">Ver documento</a>`:'';
    const text=clean(card.text||'');
    return `<article class="source-card"><span>${esc2(card.label)}</span><h4>${esc2(card.title)}</h4><p>${esc2(text.slice(0,260))}${text.length>260?'...':''}</p><div class="source-card-foot"><small>Documento: ${esc2(card.doc)}</small>${button}</div></article>`;
  }
  window.renderIntelligence=function(){
    ensureIntelShell(); const q=clean($id('intel_q')?.value||''); const ans=$id('intelAnswer'), res=$id('intelResults'); if(!ans||!res) return;
    if(!q){ if($id('intelCount'))$id('intelCount').innerText='0 fuentes'; ans.innerHTML='<div class="empty-state">Escribe una pregunta. Ejemplo: ¿La apendicitis está cubierta por PEAS?</div>'; res.innerHTML=''; return; }
    if(oncologyIntent(q)){if($id('intelCount'))$id('intelCount').innerText='1 orientación';ans.innerHTML='<div class="answer-verdict"><span>Orientación operativa</span><h3>Para temas oncológicos consultar con Auditoría Médica.</h3></div>';res.innerHTML='';return;}
    const peas=sourceAllowed('PEAS')?conditionMatches(q,5):[]; const manual=sourceAllowed('MANUAL')?buildManualHits(q,6):[]; const listas=sourceAllowed('LISTAS')?buildListaHits(q,5):[]; const caps=sourceAllowed('CAP')?buildCapHits(q,4):[]; const exclusiones=sourceAllowed('EXC')?buildExclusionHits(q,7):[]; const cards=sourceCards(peas,manual,listas,caps,exclusiones,q); if($id('intelCount'))$id('intelCount').innerText=cards.length+' coincidencias';
    if(!cards.length){ ans.innerHTML='<div class="empty-state">No encontré sustento en las fuentes cargadas. Prueba con un diagnóstico, CIE-10, prestación o término más específico.</div>'; res.innerHTML=''; return; }
    const best=cards[0];
    if(best.type==='PEAS'){ const c=peas.find(x=>x.title===best.title)||peas[0], rows=proceduresForCondition(c.title); ans.innerHTML=`<div class="answer-verdict"><span>Respuesta priorizada</span><h3>La mejor coincidencia está en PEAS.</h3><p><b>${esc2(c.title)}</b> figura como condición asegurable. Revisa la definición, diagnósticos CIE-10 y prestaciones asociadas antes de cerrar la decisión.</p><div class="source-pills"><span>PEAS · p. ${esc2(c.page)}</span><span>${(c.cie10||[]).length} CIE-10</span><span>${rows.length} prestaciones</span></div><button class="pill blue action-pill" onclick="go('peas', menuBtn('peas')); setTimeout(()=>{document.getElementById('peas_q').value='${esc2(c.title).replace(/'/g,'&#039;')}'; renderPeas();},50)">Ver decisión PEAS</button></div>`; }
    else if(best.type==='MANUAL'){ ans.innerHTML=`<div class="answer-verdict"><span>Respuesta priorizada</span><h3>La mejor coincidencia está en el Manual de Normas.</h3><p>La consulta se relaciona principalmente con criterios de facturación o revisión administrativa. Revisa los recuadros del Manual y abre el documento fuente para validar la página exacta.</p><div class="source-pills"><span>${esc2(best.doc)}</span></div></div>`; }
    else if(best.type==='EXC'){ ans.innerHTML=`<div class="answer-verdict"><span>Alerta de exclusión</span><h3>Encontré una posible exclusión o regla particular IAFAS.</h3><p>${esc2(best.text)}</p><div class="source-pills"><span>${esc2(best.label)}</span><span>${esc2(best.doc)}</span></div><p class="darwen-note">No declares exclusión definitiva sin validar plan, producto, PEAS, póliza, vigencia y excepciones documentadas.</p></div>`; }
    else { ans.innerHTML=`<div class="answer-verdict"><span>Respuesta priorizada</span><h3>Encontré coincidencias documentales para revisar.</h3><p>Revisa los recuadros de resultados y abre el documento o registro fuente según corresponda.</p><div class="source-pills"><span>${esc2(best.label)}</span><span>${esc2(best.doc)}</span></div></div>`; }
    res.innerHTML=`<div class="source-results-grid">${cards.map(cardHtml).join('')}</div>`;
  };
  window.clearIntelligenceSearch=function(){ const q=$id('intel_q'); if(q) q.value=''; window.renderIntelligence(); };
  function miniIntent(q){
    const n=norm(q);
    if(oncologyIntent(q)) return {key:'cap',label:'Auditoría Médica'};
    if(manualIntent(q)) return {key:'manual',label:'Manual de Normas'};
    if(peasIntent(q)) return {key:'peas',label:'PEAS'};
    if(/exclusion|excluido|no cubierto|no cobertura|preexist|estetica|experimental|infertil|robotica|ortesis|protesis|cpap|sctr|autolesion|extranjero|off label|digemid|fda|ema/.test(n)) return {key:'exclusion',label:'Exclusiones IAFAS'};
    if(/cobertura|cubiert|lista|carta de garantia|requiere cg|pacifico|tecnologia|prestacion/.test(n)) return {key:'cobertura',label:'Listas AB / cobertura'};
    if(/rimac|capacitacion|central|contacto|siteds|accidente|carencia|latencia|continuidad|copago|deducible|coaseguro|niño sano|nino sano|post hospital|postoperator|post operator|oncolog|maternidad|prenatal|postnatal|tiempo de espera/.test(n)) return {key:'cap',label:'Capacitaciones / operación'};
    return {key:'general',label:'Consulta general'};
  }
  function darbotCaseFacets(q){
    const n=norm(q);
    const facets=[];
    const add=(key,label,query,priority)=>{ if(!facets.some(f=>f.key===key)) facets.push({key,label,query,priority}); };
    if(/emergenc|accidente|accidental|urgencia/.test(n)) add('emergencia','Emergencia / accidente','emergencia accidental urgencia accidente',95);
    if(/hospital|internam|ingreso|estancia|alta/.test(n)) add('hospitalizacion','Hospitalización','hospitalización ingreso internamiento alta estancia',92);
    if(/carta de garantia|carta garantia|\bcg\b|autoriz/.test(n)) add('cg','Carta de garantía / autorización','carta de garantía autorización hospitalización',100);
    if(/carencia|latencia|tiempo de espera|espera/.test(n)) add('carencia','Carencia / latencia','carencia latencia tiempo de espera',98);
    if(/siteds/.test(n)) add('siteds','SITEDS','SITEDS elegibilidad cobertura',96);
    if(/copago|deducible|coaseguro/.test(n)) add('copago','Copago / deducible','copago deducible coaseguro',90);
    if(/peas|cie|cie-10|diagnost|apendic|diabetes|hipertension|parto|embarazo|neonato|cancer|vih|tuberculosis/.test(n)) add('peas','PEAS / condición asegurable',q,93);
    if(/factur|honorari|cobro|tarifa|recargo|instrumentista|anestesiolog|ayudante|quirurg|uci|habitaci|farmacia|epicrisis/.test(n)) add('manual','Facturación / norma',q,94);
    if(/exclusion|excluido|no cubierto|preexist|experimental|estetica|infertil|robotica|off label|sctr/.test(n)) add('exclusion','Exclusión / restricción',q,97);
    if(/rimac|pacifico|mapfre|sanitas|positiva|garantia de salud|ggss/.test(n)) add('iafa','IAFA / producto',q,88);
    if(/cobertura|cubiert|prestacion|tecnologia|lista/.test(n)) add('cobertura','Cobertura / prestación',q,91);
    if(!facets.length) add('general','Consulta general',q,70);
    return facets.sort((a,b)=>b.priority-a.priority);
  }
  function darbotQueryVariants(q,facets){
    const variants=[q];
    facets.forEach(f=>{ if(f.query && norm(f.query)!==norm(q)) variants.push(f.query); });
    const n=norm(q);
    const iafa=(n.match(/\b(rimac|pacifico|mapfre|sanitas|positiva|ggss)\b/)||[])[1];
    if(iafa){
      facets.slice(0,5).forEach(f=>variants.push(`${iafa} ${f.query||f.label}`));
    }
    return [...new Set(variants.map(clean).filter(Boolean))].slice(0,10);
  }
  function darbotSourcePriority(type,facets){
    const keys=new Set(facets.map(f=>f.key));
    let boost=0;
    if(type==='CAP' && (keys.has('emergencia')||keys.has('carencia')||keys.has('siteds')||keys.has('cg')||keys.has('iafa'))) boost+=2100;
    if(type==='MANUAL' && (keys.has('manual')||keys.has('hospitalizacion'))) boost+=2200;
    if(type==='PEAS' && keys.has('peas')) boost+=2400;
    if(type==='EXC' && keys.has('exclusion')) boost+=2500;
    if(type==='LISTAS' && (keys.has('cobertura')||keys.has('cg'))) boost+=1800;
    return boost;
  }
  function darbotCardRelevance(card,q,facets){
    const keys=new Set(facets.map(f=>f.key));
    const haystack=norm([card.title,card.text,card.doc].join(' '));
    const nq=norm(q);
    const important=tokens(q).filter(t=>t.length>=4);
    const hitTerms=important.filter(t=>haystack.includes(t));
    let relevance=hitTerms.length*520;
    const phrases=['emergencia accidental','carta de garantia','tiempo de espera','control post hospitalario','control postoperatorio','hospitalizacion','preexistencia','carencia','siteds'];
    phrases.forEach(ph=>{if(nq.includes(ph)&&haystack.includes(ph))relevance+=1400;});
    if(card.type==='PEAS' && !keys.has('peas')) return -1;
    if(card.type==='MANUAL' && !keys.has('manual')) return -1;
    if(card.type==='EXC' && !keys.has('exclusion')) return -1;
    if(card.type==='LISTAS' && !(keys.has('cobertura')||keys.has('cg'))) return -1;
    if(card.type==='CAP'){
      const operational=keys.has('emergencia')||keys.has('hospitalizacion')||keys.has('cg')||keys.has('carencia')||keys.has('siteds')||keys.has('copago')||keys.has('iafa');
      if(operational && hitTerms.length===0 && relevance<1200)return -1;
    }
    const iafa=(nq.match(/\b(rimac|pacifico|mapfre|sanitas|positiva|ggss)\b/)||[])[1];
    if(iafa){
      if(haystack.includes(iafa)) relevance+=2600;
      else if(card.type==='CAP' && !/lineamientos de convenios|institucional/.test(haystack)) relevance-=1800;
    }
    if(clean(q).length>80 && hitTerms.length<2 && relevance<1800)return -1;
    if(important.length<=2 && hitTerms.length>=1)relevance+=900;
    return relevance;
  }

  function darbotCollectEvidence(q){
    const intent=miniIntent(q);
    const facets=darbotCaseFacets(q);
    const variants=darbotQueryVariants(q,facets);
    const pool=[];
    const push=(card,variantIndex)=>{
      const relevance=darbotCardRelevance(card,q,facets);
      if(relevance<0)return;
      const key=[card.type,card.title,card.doc].map(x=>norm(x)).join('|');
      const existing=pool.find(x=>x._key===key);
      const variantBoost=Math.max(0,500-(variantIndex*60));
      const score=Number(card.score||0)+darbotSourcePriority(card.type,facets)+variantBoost+relevance;
      if(existing){ if(score>existing.score){Object.assign(existing,card,{score,_key:key,_relevance:relevance});} return; }
      pool.push({...card,score,_key:key,_relevance:relevance});
    };
    variants.forEach((query,vi)=>{
      const keys=new Set(facets.map(f=>f.key));
      if(keys.has('manual')) buildManualHits(query,8).forEach(r=>push({type:'MANUAL',label:'Manual de Normas',title:r._title,text:clean(r._body),doc:`Manual de Normas · p. ${r.page||'-'}`,url:manualPdf(r.page),score:r._score},vi));
      if(keys.has('peas')) conditionMatches(query,8).forEach(c=>push({type:'PEAS',label:'PEAS',title:c.title,text:clean([shortDefinition(c),(c.cie10||[]).join('; '),`Prestaciones: ${proceduresForCondition(c.title).slice(0,14).map(p=>`${p.code} ${p.denomination}`).join('; ')}`].join(' | ')),condition:c,doc:`PEAS · p. ${c.page} · ${(c.cie10||[]).length} CIE-10`,url:pdf(c.page),score:c._score},vi));
      if(keys.has('cobertura')||keys.has('cg')) buildListaHits(query,7).forEach(r=>push({type:'LISTAS',label:'Listas AB',title:r['TECNOLOGÍA'],text:clean([r['COBERTURA'],r['CONDICIONES / EXCEPCIONES']].filter(Boolean).join(' ')),doc:`Listas AB · ${r.ID} · Lista ${r.LISTA}`,score:r._score},vi));
      if(keys.has('exclusion')) buildExclusionHits(query,7).forEach(r=>push({type:'EXC',label:'Exclusiones IAFAS',title:r.grupo,text:clean([r.resumen,r.regla,r.requisitos,r.alertas].filter(Boolean).join(' ')),doc:`${r.tipo} · ${r.iafas}`,score:r._score},vi));
      buildCapHits(query,10).forEach(r=>push({type:'CAP',label:'Capacitación IAFAS',title:r.pregunta||r.tema||'Capacitación',text:clean([r.respuesta,r.accion,r.revisar,r.alerta,r.resumen,r.requisitos].filter(Boolean).join(' | ')),doc:r.fuente?`${r.fuente}${r.pagina?' · p. '+r.pagina:''}`:`${r.iafas||'Capacitación'} · ${r.categoria||r.grupo||''}`,url:capRecordUrl(r),score:r._score},vi));
    });
    const sorted=pool.filter(c=>c.score>0 && c._relevance>=0).sort((a,b)=>b.score-a.score);
    const selected=[]; const seen=new Set();
    sorted.forEach(c=>{if(selected.length<12&&!seen.has(c._key)){selected.push(c);seen.add(c._key);}});
    return {intent,facets,variants,cards:selected};
  }
  function miniSourceCards(q){
    const analysis=darbotCollectEvidence(q);
    return {intent:analysis.intent,cards:analysis.cards,facets:analysis.facets,variants:analysis.variants};
  }
  function miniChecklist(intent){
    const base=['Confirmar financiador/IAFAS, plan o producto aplicable.','Validar vigencia del convenio, póliza, tarifario o documento fuente.','No concluir cobertura solo porque aparece en una lista o catálogo.','Registrar la fuente revisada y escalar si hay conflicto documental.'];
    if(intent.key==='manual') return ['Abrir página del Manual y revisar la regla completa.', 'Confirmar si aplica a ambulatorio, emergencia, hospitalización o quirúrgico.', 'Verificar requisitos documentarios: solicitud, informe, historia, autorización o carta.', ...base.slice(0,2)];
    if(intent.key==='peas') return ['Validar condición asegurable y CIE-10 asociado.', 'Revisar prestaciones relacionadas y precisiones del capítulo.', 'Distinguir PEAS de cobertura contractual específica de la IAFAS.', ...base.slice(0,2)];
    if(intent.key==='cobertura') return ['Revisar Lista A/B, estado de cobertura y si requiere Carta de Garantía.', 'Contrastar con póliza/convenio antes de comunicar respuesta al área usuaria.', 'Confirmar excepciones o beneficios expresos si el registro indica no cubierto/restringido.', ...base.slice(0,2)];
    if(intent.key==='exclusion') return ['Confirmar IAFA, producto, plan y vigencia antes de declarar exclusión.', 'Revisar si existe excepción PEAS, continuidad legal, SCTR, programa o beneficio específico.', 'Contrastar la matriz de exclusiones con contrato, póliza, tarifario o documento operativo aplicable.', ...base.slice(0,2)];
    return base;
  }
  function miniSummary(intent,best,q){
    if(oncologyIntent(q))return ['Auditoría Médica','Para temas oncológicos consultar con Auditoría Médica.'];
    if(!best) return ['Sin fuente suficiente','No encontré sustento en las fuentes cargadas. Prueba con menos palabras o una prestación, diagnóstico, regla o código específico.'];
    if(intent.key==='manual' && best.type!=='MANUAL') return ['Sin regla clara en el Manual','La consulta parece de cobro, facturación o norma administrativa, pero no encontré una regla textual suficientemente fuerte en el Manual. Conviene revisar el PDF completo o usar términos más específicos.'];
    if(intent.key==='peas' && best.type!=='PEAS') return ['Sin coincidencia PEAS clara','La consulta parece clínica o PEAS, pero no encontré una condición asegurable suficientemente clara. Revisa con diagnóstico, CIE-10 o nombre de condición más específico.'];
    if(best.type==='MANUAL') return ['Orientación: revisar Manual de Normas',`La consulta parece administrativa o de facturación. La mejor fuente encontrada es "${best.title}". Abre el documento para revisar la página y validar la regla completa.`];
    if(best.type==='PEAS') return ['Orientación: revisar PEAS',`La consulta parece vinculada a condición asegurable o prestación PEAS. La mejor coincidencia es "${best.title}". Revisa CIE-10, prestaciones asociadas y página fuente.`];
    if(best.type==='LISTAS') return ['Orientación: revisar cobertura/Listas AB',`La consulta parece de cobertura o exclusión. La mejor coincidencia es "${best.title}". Revisa cobertura, condiciones/excepciones y si requiere Carta de Garantía.`];
    if(best.type==='EXC') return ['Alerta: posible exclusión IAFAS',`Encontré una coincidencia en la matriz de exclusiones: "${best.title}". Úsala como alerta, no como conclusión final, y valida plan, producto, PEAS, póliza y excepciones.`];
    return ['Orientación: revisar fuente operativa',`La mejor coincidencia está en ${best.label}. Úsala como guía operativa y valida el documento completo antes de responder.`];
  }
  window.miniAiUse=function(text){const q=$id('mini_ai_q'); if(q){q.value=text; q.focus();} renderMiniAI();};
  window.clearMiniAI=function(){const q=$id('mini_ai_q'); if(q)q.value=''; if($id('miniAiCount'))$id('miniAiCount').innerText='0 fuentes'; if($id('miniAiAnswer'))$id('miniAiAnswer').innerHTML='<div class="empty-state">Escribe una consulta para que el asistente priorice fuentes, riesgos y próximos pasos.</div>'; if($id('miniAiChecklist'))$id('miniAiChecklist').innerHTML='<div class="panel-head"><div><h3>Checklist operativo</h3><p>Validaciones mínimas antes de responder.</p></div></div><div class="empty-state">Pendiente de análisis.</div>'; if($id('miniAiSources'))$id('miniAiSources').innerHTML='';};
  window.renderMiniAI=function(){
    const q=clean($id('mini_ai_q')?.value||''); const ans=$id('miniAiAnswer'), list=$id('miniAiChecklist'), src=$id('miniAiSources'); if(!ans||!list||!src)return;
    if(!q){clearMiniAI();return;}
    const {intent,cards}=miniSourceCards(q); const best=cards[0]; const summary=miniSummary(intent,best,q); if($id('miniAiCount'))$id('miniAiCount').innerText=cards.length+' fuentes';
    ans.innerHTML=`<div class="mini-ai-verdict"><span class="mini-ai-label">Mini IA local · ${esc2(intent.label)}</span><h3>${esc2(summary[0])}</h3><p>${esc2(summary[1])}</p><div class="mini-ai-badges"><span>${esc2(intent.label)}</span>${best?`<span>${esc2(best.doc)}</span>`:''}</div><p><b>Nota:</b> esta orientación se genera solo con fuentes cargadas en el Hub. La respuesta final debe validarse contra convenio, póliza, tarifario y vigencia aplicable.</p></div>`;
    list.innerHTML=`<div class="panel-head"><div><h3>Checklist operativo</h3><p>Validaciones mínimas antes de responder.</p></div></div><ul>${miniChecklist(intent).map(x=>`<li>${esc2(x)}</li>`).join('')}</ul>`;
    src.innerHTML=cards.length?cards.map(cardHtml).join(''):'<div class="empty-state">No se encontraron fuentes relacionadas.</div>';
  };
  function darwenUserFirstName(){
    let display='';
    try{
      const saved=JSON.parse(sessionStorage.getItem('panel_ab_user')||'null');
      display=saved?.displayName||saved?.name||sessionUser?.displayName||sessionUser?.name||'';
    }catch(_e){
      try{display=sessionUser?.displayName||sessionUser?.name||'';}catch(__e){}
    }
    return clean(display).replace(/\./g,' ').split(/\s+/)[0]||'';
  }
  function darwenGreeting(){
    return '<p><b>Hola, soy Darbot. ¿En qué puedo ayudarte hoy?</b></p>';
  }
  function darwenEnsureVoiceStage(){
    const chat=$id('darwenChat'); if(!chat)return null;
    let stage=$id('darwenVoiceStage');
    if(stage)return stage;
    stage=document.createElement('div');
    stage.id='darwenVoiceStage';
    stage.className='darwen-voice-stage darbot-voice-compact';
    stage.innerHTML=`
      <div class="darbot-voice-indicator" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>
      </div>
      <div class="darbot-voice-copy">
        <strong>Darbot por voz</strong>
        <p id="darwenVoiceStatus">Toca el micrófono y empieza a hablar.</p>
      </div>`;
    const head=chat.querySelector('.darwen-head');
    if(head)head.insertAdjacentElement('afterend',stage);
    darwenLoadVoices();
    return stage;
  }
  function darwenVoiceStatus(text){
    darwenEnsureVoiceStage();
    const el=$id('darwenVoiceStatus');
    if(el)el.textContent=text;
  }
  function darwenEnsureGreeting(){
    const box=$id('darwenMessages'); if(!box)return;
    if(!box.children.length) darwenAddMessage('bot',darwenGreeting());
  }
  function darwenAddMessage(role,html){
    const box=$id('darwenMessages'); if(!box)return;
    const row=document.createElement('div'); row.className='darwen-msg '+role;
    row.innerHTML=`<div>${html}</div>`;
    box.appendChild(row); box.scrollTop=box.scrollHeight;
    return row;
  }
  function darwenTyping(){
    return darwenAddMessage('bot typing','<span></span><span></span><span></span>');
  }
  function darwenRemoveTyping(node){
    if(node&&node.parentNode)node.parentNode.removeChild(node);
  }
  function darwenPlainText(html){
    const div=document.createElement('div'); div.innerHTML=html; return clean(div.textContent||div.innerText||'');
  }
  let darwenSpeechEnabled=false;
  let darwenVoiceGreetingDone=false;
  let darwenMouthTimer=null;
  let darwenAudio=null;
  function darwenVisemeForWord(word){
    const w=norm(word);
    if(!w)return {shape:'rest',open:0};
    if(/[mbp]$/.test(w)||/^[mbp]/.test(w))return {shape:'closed',open:.01};
    if(/[ou]/.test(w))return {shape:'round',open:.34};
    if(/[a]/.test(w))return {shape:'open',open:.42};
    if(/[e]/.test(w))return {shape:'wide',open:.3};
    if(/[i]/.test(w))return {shape:'smile',open:.2};
    return {shape:'neutral',open:.18};
  }
  function darwenSetMouth(open,shape='neutral'){
    document.documentElement.style.setProperty('--darwen-mouth-open',String(open));
    document.documentElement.style.setProperty('--darwen-jaw-open',String(Math.min(1,Number(open)||0)));
    document.body.dataset.darwenViseme=shape;
  }
  function darwenStopTalking(){
    clearInterval(darwenMouthTimer);
    darwenMouthTimer=null;
    if(darwenAudio){
      try{darwenAudio.pause();darwenAudio.currentTime=0;}catch(_e){}
      darwenAudio=null;
    }
    darwenSetMouth(0,'rest');
    document.body.classList.remove('darwen-speaking');
  }
  function darwenStartTalking(text){
    document.body.classList.add('darwen-speaking');
    clearInterval(darwenMouthTimer);
    const words=clean(text).split(/\s+/).filter(Boolean);
    let index=0;
    darwenMouthTimer=setInterval(()=>{
      const word=words[index%Math.max(words.length,1)]||'';
      const v=darwenVisemeForWord(word);
      darwenSetMouth(v.open,v.shape);
      index+=1;
      setTimeout(()=>{ if(document.body.classList.contains('darwen-speaking'))darwenSetMouth(.01,'closed'); },105);
    },210);
  }
  function darwenVoiceScore(v){
    const name=(v.name||'').toLowerCase();
    const lang=(v.lang||'').toLowerCase();
    let score=0;
    if(lang==='es-pe')score+=80;
    else if(lang.startsWith('es-'))score+=50;
    if(/microsoft|google|natural|online|neural/.test(name))score+=35;
    if(/pablo|jorge|diego|carlos|miguel|raul|juan|pedro|luis|alvaro|antonio|male|hombre|masculin|gonzalo|andres|martin/.test(name))score+=34;
    if(/dalia|elvira|helena|sabina|paulina|maria|monica|lucia|laura|female|mujer|femenina/.test(name))score-=35;
    if(/local|compact/.test(name))score-=8;
    return score;
  }
  function darwenBestVoice(){
    if(!('speechSynthesis'in window))return null;
    const voices=window.speechSynthesis.getVoices?.()||[];
    return voices
      .filter(v=>/^es[-_]/i.test(v.lang||''))
      .sort((a,b)=>darwenVoiceScore(b)-darwenVoiceScore(a))[0]||null;
  }
  function darwenLoadVoices(){
    if(!('speechSynthesis'in window))return;
    window.speechSynthesis.getVoices?.();
  }
  if('speechSynthesis'in window){
    window.speechSynthesis.onvoiceschanged=darwenLoadVoices;
    setTimeout(darwenLoadVoices,250);
  }
  async function darwenSpeakOpenAITts(text){
    const token=sessionStorage.getItem('iafas_hub_api_token_v1')||'';
    const res=await fetch('/api/darwen-tts',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':token},body:JSON.stringify({text})});
    const payload=await res.json().catch(()=>({ok:false}));
    if(!res.ok||payload.ok===false||!payload.audio)throw new Error(payload.error||'TTS no disponible');
    if(darwenAudio){try{darwenAudio.pause();}catch(_e){}}
    const audio=new Audio(`data:audio/${payload.format||'mp3'};base64,${payload.audio}`);
    darwenAudio=audio;
    audio.onplay=()=>{darwenStartTalking(text);darwenVoiceStatus('Darbot está respondiendo.');};
    audio.onended=()=>{darwenStopTalking();darwenVoiceStatus('Toca el micrófono y empieza a hablar.');};
    audio.onerror=()=>darwenStopTalking();
    await audio.play();
  }
  function darwenVoiceReadableText(html){
    const div=document.createElement('div');
    div.innerHTML=html;
    div.querySelectorAll('p,div,li,span').forEach(el=>{
      const txt=clean(el.textContent||'');
      if(/^fuente\s*:/i.test(txt)) el.remove();
    });
    return clean(div.textContent||div.innerText||'');
  }
  async function darwenSpeak(html){
    if(!darwenSpeechEnabled)return;
    const text=darwenVoiceReadableText(html).slice(0,900); if(!text)return;
    try{await darwenSpeakOpenAITts(text);return;}catch(_e){}
    if(!('speechSynthesis'in window))return;
    window.speechSynthesis.cancel();
    darwenLoadVoices();
    const voice=darwenBestVoice();
    const u=new SpeechSynthesisUtterance(text);
    u.lang=voice?.lang||'es-PE';
    u.rate=.92;
    u.pitch=.82;
    u.volume=1;
    if(voice)u.voice=voice;
    u.onstart=()=>{darwenStartTalking(text);darwenVoiceStatus('Darbot está respondiendo.');};
    u.onboundary=e=>{
      if(typeof e.charIndex!=='number')return;
      const next=text.slice(e.charIndex).match(/^[\s.,;:¿?¡!]*([^\s.,;:¿?¡!]+)/);
      const v=darwenVisemeForWord(next?.[1]||'');
      darwenSetMouth(v.open,v.shape);
    };
    u.onend=()=>{darwenStopTalking();darwenVoiceStatus('Toca el micrófono y empieza a hablar.');};
    u.onerror=()=>darwenStopTalking();
    window.speechSynthesis.speak(u);
  }
  function darwenQuestionTopic(q){
    const raw=norm(q)
      .replace(/\b(que|cuales|cual|diagnostico|diagnosticos|cie|cie-10|procedimiento|procedimientos|prestacion|prestaciones|relacionado|relacionados|relacionada|relacionadas|asociado|asociados|vinculado|vinculados|esta|estan|figura|aparece|incluido|incluida|en|el|la|los|las|un|una|peas|plan|esencial|aseguramiento|salud)\b/g,' ')
      .replace(/[^a-z0-9.\s-]/g,' ')
      .replace(/\s+/g,' ')
      .trim();
    return raw;
  }
  function darwenExtractCieCodes(q){
    const seen=new Set();
    const hits=String(q||'').toUpperCase().match(/\b[A-Z]\d{2}(?:\.\d{1,2})?\b/g)||[];
    return hits.filter(code=>{if(seen.has(code))return false;seen.add(code);return true;});
  }
  function darwenExactCieMatches(q,limit=10){
    const codes=darwenExtractCieCodes(q);
    if(!codes.length)return [];
    const all=(window.peasConditions||[]);
    const rows=[];
    all.forEach(c=>{
      const cieRows=(c.cie10||[]);
      let exact=0, family=0;
      codes.forEach(code=>{
        const codeNorm=code.toUpperCase();
        cieRows.forEach(dx=>{
          const dxCode=(String(dx||'').toUpperCase().match(/^\s*([A-Z]\d{2}(?:\.\d{1,2})?)/)||[])[1]||'';
          if(dxCode===codeNorm)exact+=1;
          else if(!codeNorm.includes('.') && dxCode.startsWith(codeNorm+'.'))family+=1;
        });
      });
      if(exact||family)rows.push({...c,_topicScore:exact*100000+family*10000,_cieExact:exact,_cieFamily:family});
    });
    return rows.sort((a,b)=>b._topicScore-a._topicScore||a.page-b.page).slice(0,limit);
  }
  function darwenPeasTopicMatches(q,limit=10){
    const exactCie=darwenExactCieMatches(q,limit);
    if(exactCie.length)return exactCie;
    const topic=darwenQuestionTopic(q);
    const all=(window.peasConditions||[]);
    if(!topic)return conditionMatches(q,limit);
    const ttk=tokens(topic).filter(t=>t.length>=3 && !/^(dentro|fuera|parte|sobre|acerca)$/.test(t));
    let rows=all.map(c=>{
      const title=norm(c.title), def=norm(c.definition||''), cie=norm((c.cie10||[]).join(' '));
      let score=0;
      if(title.includes(topic))score+=1200;
      ttk.forEach(t=>{if(title.includes(t))score+=500;if(cie.includes(t))score+=240;if(def.includes(t))score+=80;});
      return {...c,_topicScore:score};
    }).filter(c=>c._topicScore>0).sort((a,b)=>b._topicScore-a._topicScore||a.page-b.page);
    if(!rows.length)rows=conditionMatches(topic||q,limit);
    return rows.slice(0,limit);
  }
  function darwenDirectPeasAnswer(q){
    const n=norm(q);
    const asksExistence=/\b(esta|figura|aparece|incluido|incluida|pertenece)\b.*\bpeas\b|\bpeas\b.*\b(esta|figura|aparece|incluido|incluida)\b/.test(n);
    const asksDx=/(diagnostico|diagnosticos|cie|cie-10)/.test(n) && /(relacion|asoci|vincul|cuales|que)/.test(n);
    const asksProc=/(procedimiento|procedimientos|prestacion|prestaciones)/.test(n) && /(relacion|asoci|vincul|cuales|que)/.test(n);
    if(!asksExistence && !asksDx && !asksProc)return '';
    const matches=darwenPeasTopicMatches(q,10);
    if(!matches.length){
      const topic=darwenQuestionTopic(q)||clean(q);
      return `<p>No encontré “${esc2(topic)}” como condición asegurable en la información PEAS cargada.</p><p class="darwen-note">Esto no demuestra por sí solo que esté excluido: puede requerir otra denominación o validación en la fuente completa.</p>`;
    }
    if(asksExistence){
      const c=matches[0], requested=darwenExtractCieCodes(q);
      let cie=(c.cie10||[]);
      if(requested.length){
        cie=cie.filter(dx=>{const code=((String(dx||'').toUpperCase().match(/^\s*([A-Z]\d{2}(?:\.\d{1,2})?)/)||[])[1]||''); return requested.includes(code);});
      }
      cie=cie.slice(0,4);
      return `<p>Sí. <b>${esc2(c.title)}</b> figura en PEAS.</p>${cie.length?`<p><b>Diagnóstico/CIE-10:</b> ${cie.map(esc2).join('; ')}</p>`:''}<p class="darwen-note"><b>Fuente:</b> PEAS · p. ${esc2(c.page)}. PEAS confirma la condición asegurable; la cobertura contractual específica debe validarse aparte.</p>`;
    }
    if(asksDx){
      const withDx=matches.filter(c=>(c.cie10||[]).length).slice(0,6);
      if(!withDx.length)return `<p>Encontré la condición en PEAS, pero no diagnósticos CIE-10 extraídos para esta consulta. Conviene abrir la página fuente.</p>`;
      const groups=withDx.map(c=>`<li><b>${esc2(c.title)}</b> (p. ${esc2(c.page)}):<br>${(c.cie10||[]).map(dx=>esc2(dx)).join('<br>')}</li>`).join('');
      return `<p>En PEAS encontré estos diagnósticos relacionados:</p><ul>${groups}</ul><p class="darwen-note"><b>Fuente:</b> PEAS. La relación mostrada corresponde a las condiciones y CIE-10 cargados en el Hub.</p>`;
    }
    if(asksProc){
      const c=matches[0], rows=proceduresForCondition(c.title).slice(0,12);
      if(!rows.length)return `<p><b>${esc2(c.title)}</b> figura en PEAS, pero no encontré procedimientos tabulados asociados en la extracción cargada. Revisa PEAS · p. ${esc2(c.page)}.</p>`;
      return `<p>Para <b>${esc2(c.title)}</b>, PEAS relaciona entre otros:</p><ul>${rows.map(p=>`<li><b>${esc2(p.code)}</b> · ${esc2(p.denomination)}</li>`).join('')}</ul><p class="darwen-note"><b>Fuente:</b> PEAS · condición p. ${esc2(c.page)}. Se muestran hasta 12 coincidencias.</p>`;
    }
    return '';
  }
  function darwenActionLine(intent,best){
    if(!best) return 'No encuentro evidencia suficiente en las fuentes cargadas. Te recomiendo reformular con nombre de prestación, diagnóstico, CIE-10, regla de cobro, IAFAS o palabra clave exacta.';
    if(intent.key==='manual') return 'La ruta más sólida es revisar el Manual de Normas de Facturación y confirmar la regla completa antes de responder.';
    if(intent.key==='peas') return 'La ruta más sólida es validar condición PEAS, CIE-10 y prestaciones asociadas, separándolo de la cobertura contractual de la IAFAS.';
    if(intent.key==='cobertura') return 'La ruta más sólida es contrastar Listas AB, condiciones/excepciones y si requiere Carta de Garantía.';
    if(intent.key==='cap') return 'La ruta más sólida es revisar la fuente operativa o capacitación relacionada antes de escalar la respuesta.';
    return 'Puedo orientarte con las fuentes cargadas y ordenar qué revisar primero.';
  }
  const darbotConversation={turns:[],lastSocial:'',lastUser:''};
  function darbotRemember(role,text){
    const value=clean(text||''); if(!value)return;
    darbotConversation.turns.push({role,text:value,at:Date.now()});
    if(darbotConversation.turns.length>12)darbotConversation.turns.splice(0,darbotConversation.turns.length-12);
    if(role==='user')darbotConversation.lastUser=value;
  }
  function darbotRecentHistory(limit=6){
    return darbotConversation.turns.slice(-limit).map(x=>({role:x.role,content:x.text}));
  }
  function darwenSmallTalk(q){
    const n=norm(q).replace(/[,;:]+/g,' ').replace(/\s+/g,' ').trim();
    // Conversación social básica y continuidad. Se resuelve ANTES de consultar fuentes del Hub.
    const saludo='(?:hola|holaa+|buenas|buenos dias|buenas tardes|buenas noches|hey|ola|que tal)';
    const bienestar='(?:como estas|como te encuentras|como vas|como te va|que tal estas|que tal te va|como ha ido|como te ha ido|como estuvo tu dia|como va tu dia|como amaneciste)';
    const today='(?:hoy|el dia de hoy)?';
    if(new RegExp('^(?:'+saludo+'\\s+)?'+bienestar+'(?:\\s+'+today+')?(?:[\\s\\?\\!\\.]*)$').test(n)){
      darbotConversation.lastSocial='bienestar';
      return '<p>¡Hola! Va muy bien por aquí 😄. Estoy listo para conversar contigo o meternos de frente a revisar un caso del Hub. ¿Cómo va tu día?</p>';
    }
    if(new RegExp('^'+saludo+'(?:[\\s\\?\\!\\.]*)$').test(n)){
      darbotConversation.lastSocial='saludo';
      return '<p>¡Holaaa! 😄 Qué gusto verte por aquí. ¿Cómo estás? Podemos conversar un rato o revisar cualquier consulta de IAFAS que tengas.</p>';
    }
    if(/^(?:bien|muy bien|todo bien|genial|excelente|tranquilo|tranquila|ahi vamos|más o menos|mas o menos|cansado|cansada|estresado|estresada)[\s?.!]*$/.test(n) && darbotConversation.lastSocial){
      return /cansad|estresad|mas o menos|más o menos/.test(n)
        ? '<p>Te entiendo. Si quieres, hacemos esto simple: dime qué necesitas resolver primero y lo ordenamos sin recargarte.</p>'
        : '<p>¡Me alegra! 😄 Entonces estamos listos. ¿Qué quieres revisar hoy?</p>';
    }
    if(/que haces|que estas haciendo|en que andas/.test(n)) return '<p>Aquí, pendiente del Hub 😄. Puedo conversar contigo y también ayudarte a analizar coberturas, PEAS, Manual, factores, exclusiones o reglas operativas.</p>';
    if(/quien eres|como te llamas|que eres|tu nombre/.test(n)) return '<p>Soy Darbot, el asistente del IAFAS Intelligence Hub. Puedo conversar contigo con naturalidad y, cuando el tema es operativo, buscar sustento en las fuentes cargadas antes de responder.</p>';
    if(/^(?:que puedes hacer|ayuda|ayudame|como funcionas|para que sirves)[\s?.!]*$/.test(n)) return '<p>Puedo conversar contigo, entender consultas escritas de forma natural, revisar varias fuentes del Hub, comparar evidencias y decirte qué está sustentado, qué falta validar y dónde revisarlo.</p>';
    if(/gracias|muchas gracias|thank/.test(n)) return '<p>¡Con gusto! 😄 Aquí me quedo. Si quieres seguimos con otro caso o con cualquier duda que tengas.</p>';
    if(/^(?:ok|okay|perfecto|perfecta|listo|lista|dale|de acuerdo|ya)[\s?.!]*$/.test(n)) return '<p>Perfecto 😄. Te sigo. Dime qué hacemos ahora.</p>';
    if(/hasta luego|nos vemos|chau|chao|adios|adiós/.test(n)) return '<p>¡Nos vemos! Que te vaya muy bien. Cuando vuelvas, seguimos desde donde lo dejamos.</p>';
    return '';
  }
  function relevantSourceLines(text,q){
    const tk=tokens(q).filter(t=>t.length>=3);
    const lines=clean(text).split(/(?<=[.;:])\s+|\n+/).map(clean).filter(Boolean);
    return lines.map(line=>{
      const nl=norm(line);
      let score=0;
      tk.forEach(t=>{ if(nl.includes(t))score+=1; });
      if(/(\d+\s*%|\d{1,2}:\d{2}|tarifa|recargo|adicional|carta de garantia|requiere|no requiere|cubierto|excluido)/i.test(line))score+=2;
      return {line,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.line);
  }
  function directFactAnswer(q,cards){
    const best=cards?.[0]; if(!best)return '';
    const nq=norm(q);
    const asksFact=/cuanto|cu[aá]nto|paga|pago|porcentaje|recargo|adicional|horario|hora|horas|honorari|fallec|ingreso|egreso|estancia|turno|requiere|carta de garantia|cg|cubre|cubierto|excluido|condicion|excepcion|aplica/.test(nq);
    if(!asksFact || (best.score||0)<120)return '';
    const lines=relevantSourceLines(best.text||'',q);
    if(!lines.length)return '';
    let answer=lines[0];
    if(/nocturn/.test(nq) && /20\s*%/.test((best.text||'')+answer)){
      answer='Para horario nocturno, corresponde un recargo del 20% sobre la tarifa diurna. El horario nocturno es entre las 20:00 y las 08:00 del día siguiente.';
    }
    if(/fallec/.test(nq) && /fallecimiento despues de las 12:00 horas/i.test(norm(best.text||''))){
      answer='En el día de egreso, el Manual establece como excepción de facturación el fallecimiento después de las 12:00 horas.';
    }
    if(/instrumentista/.test(nq) && /6\s*%/.test(best.text||'')){
      answer='El honorario rutinario del Instrumentista se factura a razón del 6 % del Honorario del Cirujano.';
    }
    return `<p>${esc2(answer)}</p><p class="darwen-note"><b>Fuente:</b> ${esc2(best.doc)} · ${esc2(best.title)}</p><p class="darwen-note">Validar que el caso corresponda al mismo concepto, horario y regla de facturación antes de cerrar la respuesta.</p>`;
  }
  function darwenManualTopic(q){
    return norm(q)
      .replace(/\b(cuanto|cuanta|cuantos|cuantas|que|cual|cuales|como|donde|cuando|dice|indica|establece|corresponde|se|le|les|el|la|los|las|un|una|en|de|del|para|por|sobre|manual|norma|normas|facturacion|facturar|factura|honorario|honorarios)\b/g,' ')
      .replace(/[^a-z0-9%\s-]/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }
  function darwenDirectManualAnswer(q){
    if(!manualIntent(q))return '';
    const records=(window.manualRecords||((typeof manualRecords!=='undefined')?manualRecords:[])||[]);
    const nq=norm(q);
    const topic=darwenManualTopic(q);
    const qtk=tokens(q).filter(t=>t.length>=3);

    // Consultas del Manual con una regla/segmento específico: resolver antes de la búsqueda difusa.
    // Esto evita devolver índices, encabezados vecinos o reglas generales cuando existe un dato exacto.
    if(/unidad\s+de\s+quemados|quemados/.test(nq)){
      const r=records.find(x=>/C\.\s*Unidad de Quemados/i.test(String(x.heading||x.title||'')) && /atenci[oó]n exclusiva y especializada/i.test(String(x.text||x.body||'')));
      if(r){
        const answer='La Unidad de Quemados es el servicio de atención exclusiva y especializada del paciente quemado, que no puede ser brindada en otro servicio de hospitalización. Incluye cama hospitalaria, cama especializada Striker, ropa de cama y del paciente, atención del médico residente, equipos de monitoreo, mantenimiento, higiene y limpieza, alimentación completa —incluidas dietas especiales indicadas por el médico—, servicios auxiliares de apoyo permanente y termómetro. No incluye materiales, insumos ni aditamentos de uso único o desechable utilizados por el paciente.';
        return `<p>${esc2(answer)}</p><p class="darwen-note"><b>Fuente:</b> Manual de Normas · p. ${esc2(r.page||8)} · C. Unidad de Quemados</p>`;
      }
    }
    if(/epicrisis/.test(nq)){
      const r=records.find(x=>/Epicrisis:/i.test(String(x.text||x.body||'')) && /adjuntar[aá] a toda factura/i.test(String(x.text||x.body||'')));
      if(r){
        const answer='La epicrisis debe adjuntarse rutinariamente a toda factura: una copia de la epicrisis de la Historia Clínica y de las interconsultas. Además, el Manual señala que la Historia Clínica debe incluir epicrisis en los casos de hospitalización.';
        return `<p>${esc2(answer)}</p><p class="darwen-note"><b>Fuente:</b> Manual de Normas · p. ${esc2(r.page||32)} · VII. Auditoría Médica y Procesos de Atención</p>`;
      }
    }
    if(/sala\s+de\s+recuperacion|recuperacion\s+post\s*anestesi/i.test(nq)){
      const r=records.find(x=>/E\.\s*Sala de Recuperaci[oó]n/i.test(String(x.text||x.body||'')));
      if(r){
        const answer='La Sala de Recuperación incluye atención médica y de enfermería integral, permanente y especializada, además del uso de equipos de monitoreo general. Pulsoxímetro, capnógrafo y desfibrilador son opcionales sin costo adicional. No incluye materiales, insumos ni aditamentos de uso único o desechables. Aplica a pacientes sometidos a anestesia general o regional, no a anestesia local.';
        return `<p>${esc2(answer)}</p><p class="darwen-note"><b>Fuente:</b> Manual de Normas · p. ${esc2(r.page||9)} · E. Sala de Recuperación</p>`;
      }
    }
    if(/apendicectom/.test(nq) && /estancia|dias|d[ií]as|hospital/.test(nq)){
      const r=records.find(x=>/Apendicectom[ií]a:\s*Hasta dos/i.test(String(x.text||x.body||'')));
      if(r){
        const answer='Para apendicectomía, el Anexo 3 señala una estancia de hasta dos (02) días, en ausencia de complicaciones. El propio anexo indica que estos promedios son referenciales, están sujetos a consenso entre Financiador y Proveedor y pueden modificarse según la revisión del Tarifario.';
        return `<p>${esc2(answer)}</p><p class="darwen-note"><b>Fuente:</b> Manual de Normas · p. ${esc2(r.page||44)} · Anexo 3: Días de Estancia Hospitalaria</p>`;
      }
    }

    let rows=records.map(r=>{
      const body=clean(typeof manualBody==='function'?manualBody(r):(r.text||r.body||''));
      const title=clean(typeof manualTitle==='function'?manualTitle(r):(r.title||r.heading||'Manual'));
      const nt=norm(title), nb=norm(body);
      let score=0;
      if(topic && nt.includes(topic))score+=9000;
      if(topic && nb.includes(topic))score+=3000;
      if(nq.includes(nt) && nt.length>=5)score+=6500;
      qtk.forEach(t=>{
        if(nt.includes(t))score+=900;
        if(nb.includes(t))score+=(t.length>=6?1200:180);
      });
      if(/cuanto|cu[aá]nto|porcentaje|adicion|recargo|honorari|paga|pago/.test(nq) && /\d+\s*%/.test(body))score+=1800;
      if(/hora|horas|horario|feriad|nocturn|fallec/.test(nq) && /(\d{1,2}:\d{2}|\d+\s*horas|feriad|nocturn|fallec)/i.test(body))score+=1200;
      if(body.length>title.length+18)score+=500;
      if(/indice|índice/i.test(title)||((r.page||0)<=6 && body.length>500))score-=3500;
      return {...r,_title:title,_body:body,_scoreDirect:score};
    }).filter(r=>r._scoreDirect>0).sort((a,b)=>b._scoreDirect-a._scoreDirect||((a.page||999)-(b.page||999)));
    if(!rows.length)return '';
    const best=rows[0];
    if(best._scoreDirect<1200)return '';
    let answer=best._body;
    const t=clean(best._title);
    if(t && norm(answer).startsWith(norm(t))){
      answer=clean(answer.slice(t.length).replace(/^[:.\-\s]+/,''));
    }
    if(!answer)answer=t;
    // Reglas puntuales conocidas del Manual: devolver el dato esencial sin checklist.
    // Definiciones y conceptos exactos deben ganar antes que la búsqueda difusa.
    if(/\buci\b|unidad de cuidados intensivos|cuidados intensivos/.test(nq) && /que es|qué es|definicion|definición|significa|concepto/.test(nq)){
      const uci=records.find(r=>/3\.2 UNIDAD DE CUIDADOS INTENSIVOS \(UCI\)/i.test(String(r.heading||r.title||'')) && /unidad de internamiento/i.test(String(r.text||r.body||'')));
      if(uci){
        answer='La Unidad de Cuidados Intensivos (UCI) es la unidad de internamiento para pacientes, de cualquier edad, que se encuentran en estado crítico, con posibilidad de recuperación parcial o total, y que requieren para su supervivencia atención médica y de enfermería permanente, además de equipos e instrumental para el control adecuado de su tratamiento.';
        best.page=uci.page; best._title=uci.heading||uci.title||'3.2 Unidad de Cuidados Intensivos (UCI)';
      }
    } else if(/obstetriz/.test(nq)){
      const vag=records.find(r=>/10\. Obstetriz/i.test(String(r.heading||r.title||'')) && /8\s*%/i.test(String(r.text||r.body||'')));
      const ces=records.find(r=>/10\.2/i.test(String(r.heading||r.title||'')) && /Obstetriz/i.test(String(r.text||r.body||'')) && /4\s*%/i.test(String(r.text||r.body||'')));
      if(vag){
        answer='El honorario de la Obstetriz depende del resultado del parto: en parto vaginal equivale al 8 % de los honorarios del Obstetra; si el trabajo de parto termina en cesárea por razones de emergencia, equivale al 4 % de los honorarios del Obstetra.';
        best.page=vag.page; best._title='10. Obstetriz';
      }
    } else if(/nocturn/.test(nq)){
      const noct=records.find(r=>/Horario Nocturno/i.test(String(r.heading||r.title||'')) && /20\s*%/i.test(String(r.text||r.body||'')));
      const aplica=records.find(r=>/operaciones realizadas de emergencia/i.test(String(r.text||r.body||'')) && /consultas originadas por emergencias/i.test(String(r.text||r.body||'')));
      if(noct){
        answer='El horario nocturno, comprendido entre las 20:00 y las 08:00 del día siguiente, tiene un recargo del 20 % sobre la tarifa diurna. El Manual señala que este recargo es válido para operaciones de emergencia debidamente comprobadas y para consultas originadas por emergencias debidamente documentadas, aplicables en Emergencia y Hospitalización de la Clínica.';
        best.page=noct.page; best._title='7. Recargo en Honorarios Médicos y Quirúrgicos por Horario Nocturno y Feriados';
      }
    } else if(/fallec/.test(nq)){
      const r=records.find(x=>/fallecimiento después de las 12:00 horas/i.test(String(x.text||x.body||'')));
      if(r){answer='El día de egreso no se factura, excepto, entre otros casos, cuando ocurre un fallecimiento después de las 12:00 horas.'; best.page=r.page; best._title=r.heading||r.title||'Regla de ingreso y egreso';}
    } else if(/injerto.*oseo|oseo.*injerto/.test(nq) && /50\s*%/.test(best._body)){
      answer='En los procedimientos que requieran injerto óseo se adicionará el 50 % como concepto de obtención del mismo.';
    } else if(/feriad/.test(nq) && /20\s*%/.test(best._body)){
      answer='Los sábados desde las 14:00 horas, las 24 horas del domingo y los feriados tienen un recargo del 20 % sobre la tarifa diurna.';
    } else if(/cardiolog.*intervencion|intervencion.*cardiolog/.test(nq) && /ayudante|instrumentista/.test(norm(best._body))){
      answer='En los procedimientos de Cardiología Intervencionista que requieran Ayudante, Instrumentista o ambos, se facturará según se indique en el tarifario.';
    } else if(/sala.*bebe|bebe.*sala/.test(nq)){
      const sala=records.find(r=>/sala de beb[eé]s/i.test(String(r.heading||r.title||'')) && /cuna|incubadora/i.test(String(r.text||r.body||'')));
      if(sala){
        answer=clean(sala.text||sala.body||'').replace(/^G\.\s*Sala de Beb[eé]s\s*/i,'');
        best.page=sala.page; best._title=sala.heading||sala.title||'G. Sala de Bebés';
      }
    }
    return `<p>${esc2(answer)}</p><p class="darwen-note"><b>Fuente:</b> Manual de Normas · p. ${esc2(best.page||'-')} · ${esc2(best._title)}</p>`;
  }

  // ---------------------------------------------------------------------------
  // Darwen Smart Retrieval v2
  // Motor general para leer el Manual por concepto + intención, no por coincidencia
  // aislada de palabras. También conserva contexto breve para preguntas de seguimiento.
  // ---------------------------------------------------------------------------
  const darwenCtx={lastQuery:'',lastDomain:'',lastTopic:'',lastSource:'',lastKind:''};

  function darwenContentTokens(q){
    const discard=new Set([
      'que','qué','cual','cuál','cuales','cuáles','como','cómo','cuando','cuándo','donde','dónde','cuanto','cuánto','cuanta','cuánta','cuantos','cuántos','cuantas','cuántas',
      'se','le','les','lo','la','los','las','el','un','una','unos','unas','de','del','en','para','por','sobre','con','sin','al','a','y','o','es','son','esta','está','estan','están',
      'factura','facturar','facturacion','facturación','paga','pagar','pago','aplica','aplicar','corresponde','indica','dice','establece','manual','norma','normas',
      'honorario','honorarios','porcentaje','incluye','incluyen','significa','definicion','definición','concepto','cuanto','cuánto','valor','monto','regla'
    ]);
    return norm(q).split(/[^a-z0-9áéíóúñü.-]+/).filter(Boolean).filter(t=>t.length>=2 && !discard.has(t));
  }

  function darwenQuestionKind(q){
    const n=norm(q);
    if(/porcentaje|\d+\s*%|cuanto.*%|cuánto.*%|cuanto porcentaje|cuánto porcentaje/.test(n))return 'percentage';
    if(/dias? de estancia|días? de estancia|estancia.*dias|estancia.*días|cuantos dias|cuántos días/.test(n))return 'stay';
    if(/hora|horario|desde que hora|a partir de que hora|a partir de qué hora|nocturn|feriad/.test(n))return 'time';
    if(/que incluye|qué incluye|incluye|comprende/.test(n))return 'includes';
    if(/que es|qué es|definicion|definición|significa|entiendase|entiéndase/.test(n))return 'definition';
    if(/como se factura|cómo se factura|factur|cobr|paga|pago|honorari/.test(n))return 'billing';
    if(/requiere|requisito|documento|adjunt|sustento/.test(n))return 'requirement';
    return 'general';
  }

  function darwenMajorHeading(line){
    const x=clean(line);
    if(!x || x.length>150)return false;
    return /^(?:[A-ZÁÉÍÓÚÑ]\.\s+|\d+\.\s+[A-ZÁÉÍÓÚÑ]|[IVXLCDM]+\.\s+|(?:Epicrisis|Historia Clínica|Interconsultas|Hospitalización|Emergencia|Ambulatorio)\s*:)/i.test(x);
  }

  function darwenManualFragments(){
    const records=(window.manualRecords||((typeof manualRecords!=='undefined')?manualRecords:null)||window.manualData||[]);
    const out=[];
    records.forEach((r,ri)=>{
      const rawBody=String(r.text||r.body||(typeof manualBody==='function'?manualBody(r):'')||'');
      const body=clean(rawBody);
      const title=clean(typeof manualTitle==='function'?manualTitle(r):(r.heading||r.title||'Manual'));
      const lines=rawBody.split(/\n+/).map(clean).filter(Boolean);
      let current=[];
      const flush=()=>{
        if(!current.length)return;
        const first=current[0];
        const heading=darwenMajorHeading(first)?first:title;
        out.push({record:r,ri,page:r.page||'',chapter:r.chapter||'',heading,text:current.join('\n')});
        current=[];
      };
      lines.forEach(line=>{
        if(current.length && darwenMajorHeading(line))flush();
        current.push(line);
      });
      flush();
      if(!lines.length && title)out.push({record:r,ri,page:r.page||'',chapter:r.chapter||'',heading:title,text:body||title});
    });
    return out;
  }

  function darwenSmartManualSearch(q){
    let kind=darwenQuestionKind(q);
    let content=darwenContentTokens(q);
    let resolved=String(q||'');
    // Seguimientos breves: "¿y el primero?", "¿qué porcentaje se le aplica?"
    const genericFollow=new Set(['primero','primer','segundo','segunda','otro','otros','otra','otras','mismo','misma']);
    const isFollow=(content.length===0 || (content.length===1 && genericFollow.has(content[0]))) && darwenCtx.lastDomain==='MANUAL' && darwenCtx.lastTopic;
    if(isFollow){
      resolved=(q+' '+darwenCtx.lastTopic).trim();
      content=darwenContentTokens(resolved);
      if(kind==='general' && darwenCtx.lastKind)kind=darwenCtx.lastKind;
    }
    if(!content.length)return null;
    const phrase=content.join(' ');
    const frags=darwenManualFragments();
    let scored=frags.map(f=>{
      const nh=norm(f.heading), nt=norm(f.text), nr=norm(resolved);
      let score=0;
      if(phrase && nh.includes(phrase))score+=30000;
      if(phrase && nt.includes(phrase))score+=9000;
      let headingHits=0,bodyHits=0;
      content.forEach(t=>{
        if(nh.includes(t)){score+=5000;headingHits++;}
        if(nt.includes(t)){score+=700;bodyHits++;}
      });
      if(content.length>1 && headingHits===content.length)score+=15000;
      if(content.length>1 && bodyHits===content.length)score+=3500;
      if(kind==='percentage' && /\d+(?:[.,]\d+)?\s*%/.test(f.text))score+=4000;
      if(kind==='billing' && /factur|honorario|tarifa|cobro|raz[oó]n del|equivalente/i.test(f.text))score+=2500;
      if(kind==='includes' && /incluye|incluido|incluidos|comprende/i.test(f.text))score+=3000;
      if(kind==='definition' && /enti[eé]ndase|se entiende|es la|es el|unidad de|servicio de/i.test(f.text))score+=1800;
      if(kind==='definition' && /enti[eé]ndase|se entiende por|unidad de internamiento|es (?:la|el|una|un) /i.test(f.text))score+=6000;
      if(kind==='stay' && /hasta\s+(?:\w+\s+)?\(?\d+\)?\s*d[ií]as|estancia/i.test(f.text))score+=3500;
      if(kind==='time' && /\d{1,2}:\d{2}|\d+\s*horas|despu[eé]s de las|desde las/i.test(f.text))score+=2500;
      if(kind==='requirement' && /adjunt|requiere|deber[aá]|document|historia|epicrisis/i.test(f.text))score+=1800;
      if((f.page||0)<=6 || /[ií]ndice/i.test(f.heading))score-=25000;
      if(clean(f.text).length <= clean(f.heading).length+18)score-=22000;
      else score+=1200;
      // Evitar que un capítulo genérico gane a una sección específica.
      if(norm(f.heading)===norm(f.chapter) && f.chapter)score-=3000;
      return {...f,score,headingHits,bodyHits};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.page-b.page);
    if(!scored.length || scored[0].score<4500)return null;
    const best=scored[0];
    const gap=scored[1]?best.score-scored[1].score:best.score;
    return {best,alternatives:scored.slice(1,5),kind,resolved,content,confidence:best.score,gap,usedContext:isFollow};
  }

  function darwenManualContextText(hit){
    const best=hit.best;
    const records=(window.manualRecords||((typeof manualRecords!=='undefined')?manualRecords:null)||window.manualData||[]);
    let pieces=[best.text];
    const topic=hit.content;
    // Si la sección termina en una introducción/cuadro, anexar el registro siguiente de la misma página
    // cuando contiene el mismo concepto o porcentajes/reglas que completan la sección.
    const major=(clean(best.heading).match(/^(\d+)\.\s+/)||[])[1]||'';
    for(let i=best.ri+1;i<Math.min(records.length,best.ri+5);i++){
      const r=records[i];
      const pg=Number(r.page||0), bpg=Number(best.page||0);
      if(pg && bpg && pg>bpg+1)break;
      const txt=clean(typeof manualBody==='function'?manualBody(r):(r.text||r.body||''));
      const rh=clean(r.heading||r.title||'');
      const nr=norm(txt+' '+rh);
      const shareCount=topic.filter(t=>nr.includes(t)).length;
      const shares=shareCount>=Math.min(2,topic.length);
      const startsBullet=/^[-•]/.test(txt);
      const completes=clean(best.text).endsWith(':') && startsBullet;
      const child=major && new RegExp('^'+major+'\.\d+\b').test(rh);
      const otherMajor=(rh.match(/^(\d+)\.\s+/)||[])[1]||'';
      if(otherMajor && major && otherMajor!==major)break;
      if(shares||completes||child)pieces.push(txt);
      else if(pg!==bpg)break;
    }
    return pieces.join('\n');
  }

  function darwenRelevantLines(text,content,kind){
    const lines=String(text||'').split(/\n+|(?<=[.;])\s+|\s+[−•]\s*/).map(clean).filter(Boolean);
    const scored=lines.map((line,idx)=>{
      const nl=norm(line); let score=0;
      content.forEach(t=>{if(nl.includes(t))score+=5;});
      if(kind==='percentage' && /\d+(?:[.,]\d+)?\s*%/.test(line))score+=10;
      if(kind==='billing' && /factur|honorario|tarifa|equivalente|raz[oó]n/i.test(line))score+=7;
      if(kind==='includes' && /incluye|incluido|no est[aá] incluido/i.test(line))score+=8;
      if(kind==='definition' && /enti[eé]ndase|se entiende|es la|es el|servicio de|unidad de/i.test(line))score+=8;
      if(kind==='stay' && /hasta|d[ií]as|estancia/i.test(line))score+=9;
      if(kind==='time' && /\d{1,2}:\d{2}|horas|despu[eé]s|desde/i.test(line))score+=9;
      if(kind==='requirement' && /adjunt|requiere|deber|historia|epicrisis|factura/i.test(line))score+=8;
      return {line,score,idx};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.idx-b.idx);
    const chosen=[];
    scored.forEach(x=>{if(chosen.length<5 && !chosen.some(y=>y.line===x.line))chosen.push(x);});
    return chosen.sort((a,b)=>a.idx-b.idx).map(x=>x.line);
  }

  function darwenComposeManualAnswer(q,hit){
    const context=darwenManualContextText(hit);
    const nq=norm(q), kind=hit.kind, content=hit.content;
    let lines=darwenRelevantLines(context,content,kind);

    if(kind==='time' && clean(context).length<=700){
      lines=[clean(context)];
    }

    // En secciones cortas de facturación/honorarios, conservar la oración completa aunque el PDF la haya partido en varias líneas.
    if(kind==='billing' && clean(context).length<=900){
      const raw=String(context||'').split(/\n+/).map(clean).filter(Boolean);
      const body=raw.filter((x,i)=>!(i===0 && norm(x)===norm(hit.best.heading)));
      if(body.length)lines=[body.join(' ')];
    }

    // Porcentajes: si el usuario especifica primer/otro ayudante, entregar solo el correspondiente.
    if(kind==='percentage' || /porcentaje/.test(nq)){
      const pct=String(context).split(/\n+|(?<=[.;])\s+/).map(clean).filter(x=>/\d+(?:[.,]\d+)?\s*%/.test(x));
      if(/primer|primero/.test(nq) && /ayudant/.test(nq)) lines=pct.filter(x=>/primer ayudante/i.test(x));
      else if(/otros? ayudantes?/.test(nq)) lines=pct.filter(x=>/otros? ayudantes?/i.test(x));
      else if(/instrumentista/.test(nq)) lines=pct.filter(x=>/instrumentista/i.test(x));
      else if(/obstetriz/.test(nq)) lines=pct.filter(x=>/obstetriz|obstetra|parto/i.test(x));
      else if(/anestesiolog/.test(nq)) lines=pct.filter(x=>/anestesi[oó]logo|cirujano/i.test(x));
      else if(/ayudant/.test(nq)) lines=pct.filter(x=>/ayudante/i.test(x));
      if(!lines.length && pct.length)lines=pct.slice(0,4);
    }

    // Para "qué incluye" o definiciones, devolver el bloque de la sección, no un índice.
    if(kind==='includes' || kind==='definition'){
      const raw=String(context).split(/\n+/).map(clean).filter(Boolean);
      const body=raw.filter((x,i)=>!(i===0 && norm(x)===norm(hit.best.heading)));
      if(body.length)lines=body;
    }

    // Estancias: priorizar únicamente el procedimiento consultado, no todo el anexo.
    if(kind==='stay'){
      const raw=String(context).split(/\n+/).map(clean).filter(Boolean);
      const target=content.filter(t=>!['dia','dias','estancia','hospital','hospitalaria','hospitalario'].includes(t));
      const joined=String(context||'').replace(/\n+/g,' ');
      let exact=[];
      const segments=joined.split(/[−•]/).map(clean).filter(Boolean);
      if(target.length) exact=segments.filter(seg=>target.some(t=>norm(seg).includes(t)) && /d[ií]as|hasta/i.test(seg));
      if(!exact.length) exact=raw.filter(x=>(target.length?target.some(t=>norm(x).includes(t)):content.some(t=>norm(x).includes(t))) && /d[ií]as|hasta/i.test(x));
      if(exact.length)lines=exact.slice(0,3);
    }

    if(kind==='general'){
      const raw=String(hit.best.text||'').split(/\n+/).map(clean).filter(Boolean);
      const body=raw.filter((x,i)=>!(i===0 && norm(x)===norm(hit.best.heading)));
      if(body.length && body.join(' ').length<=900)lines=body;
    }

    if(!lines.length)return '';
    // Quitar encabezados repetidos y texto de índice.
    lines=lines.filter(x=>!/[ií]ndice general/i.test(x)).filter((x,i,a)=>a.indexOf(x)===i);
    let answer=lines.join(' ').replace(/\s+/g,' ').trim();
    const htxt=clean(hit.best.heading||'');
    if(kind!=='time' && htxt && norm(answer).startsWith(norm(htxt))) answer=clean(answer.slice(htxt.length).replace(/^[:.\-\s]+/,''));
    if(answer.length>900)answer=answer.slice(0,897).replace(/\s+\S*$/,'')+'…';
    if(!answer)return '';

    let heading=hit.best.heading||hit.best.record?.heading||hit.best.chapter||'Manual de Normas';
    // Si el mejor fragmento es una continuación con encabezado genérico, recuperar la sección padre inmediata.
    if(hit.best.chapter && norm(heading)===norm(hit.best.chapter)){
      const records=(window.manualRecords||((typeof manualRecords!=='undefined')?manualRecords:null)||window.manualData||[]);
      for(let j=hit.best.ri-1;j>=Math.max(0,hit.best.ri-3);j--){
        const pr=records[j]; if((pr.page||'')!==(hit.best.page||''))break;
        const ph=clean(pr.heading||pr.title||'');
        const ptxt=norm((pr.text||'')+' '+ph);
        if(ph && hit.content.some(t=>ptxt.includes(t)) && norm(ph)!==norm(pr.chapter||'')){heading=ph;break;}
      }
    }
    darwenCtx.lastDomain='MANUAL';
    darwenCtx.lastTopic=hit.content.join(' ');
    darwenCtx.lastSource=`Manual de Normas · p. ${hit.best.page||'-'} · ${heading}`;
    darwenCtx.lastKind=kind;
    return `<p>${esc2(answer)}</p><p class="darwen-note"><b>Fuente:</b> Manual de Normas · p. ${esc2(hit.best.page||'-')} · ${esc2(heading)}</p>`;
  }

  function darwenSmartManualAnswer(q){
    const hit=darwenSmartManualSearch(q);
    if(!hit)return '';
    // Solo asumir que es Manual si hay señal explícita o una coincidencia conceptual fuerte.
    const explicit=manualIntent(q);
    const strong=hit.confidence>=12000 && (hit.best.headingHits>0 || hit.best.bodyHits>=2);
    if(!explicit && !strong && !hit.usedContext)return '';
    return darwenComposeManualAnswer(hit.resolved||q,hit);
  }

  function darwenResolvedQuery(q){
    const content=darwenContentTokens(q);
    const genericFollow=new Set(['primero','primer','segundo','segunda','otro','otros','otra','otras','mismo','misma']);
    if((content.length===0 || (content.length===1 && genericFollow.has(content[0]))) && darwenCtx.lastTopic && /^(y\b|que\b|qué\b|cuanto\b|cuánto\b|cual\b|cuál\b|como\b|cómo\b|porcentaje\b)/.test(norm(q))){
      return `${q} ${darwenCtx.lastTopic}`;
    }
    return q;
  }

  function darwenDirectTrainingAnswer(q){
    if(oncologyIntent(q))return '<p>Para temas oncológicos consultar con Auditoría Médica.</p>';
    const hits=buildCapHits(q,5);
    if(!hits.length)return '';
    const best=hits[0];
    const second=hits[1];
    const score=Number(best._score||0);
    const margin=score-Number(second?second._score:0);
    const nq=norm(q);
    const operational=/carencia|latencia|continuidad|siteds|emergencia accidental|post hospital|postoperator|post operator|niño sano|nino sano|copago|deducible|coaseguro|tiempo de espera|oncolog|postnatal|prenatal|maternidad|carta de garantia|carta garantía/.test(nq);
    // Requiere una coincidencia fuerte para evitar que la capacitación desplace Manual, PEAS o Listas AB por una palabra incidental.
    if(score<520 && !operational)return '';
    if(score<220 && operational)return '';
    if(second && margin<35 && score<900)return '';
    const answer=clean(best.respuesta||best.resumen||'');
    if(!answer)return '';
    const source=best.fuente||'Lineamientos de Convenios, Cobertura y Pertinencia Médica 2026';
    const page=best.pagina||best.pagelink||'-';
    darwenCtx.lastDomain='CAPACITACION';
    darwenCtx.lastTopic=clean(best.pregunta||best.tema||q);
    darwenCtx.lastSource=`${source} · p. ${page}`;
    darwenCtx.lastKind='operativo';
    return `<p>${esc2(answer)}</p><p class="darwen-note"><b>Fuente:</b> ${esc2(source)} · p. ${esc2(page)}</p>`;
  }

  function darbotIsComplexCase(q){
    const facets=darbotCaseFacets(q);
    const n=norm(q);
    const connectors=(n.match(/\b(pero|luego|despues|ademas|entonces|posterior|posteriormente|mientras|aunque|si|cuando|requiere|necesita|pasa|queda)\b/g)||[]).length;
    return facets.length>=2 || connectors>=2 || clean(q).length>=140;
  }

  function darbotLocalComplexAnswer(q,cards){
    const relevant=(cards||[]).filter(c=>c.type==='CAP').slice(0,5);
    if(!relevant.length)return '';
    const blocks=relevant.map(c=>{
      const lines=clean(c.text||'').split(/\s*\|\s*/).filter(Boolean);
      const fact=lines[0]||clean(c.text||'');
      return '<li><b>'+esc2(c.title)+'</b>: '+esc2(fact)+'</li>';
    }).join('');
    const sources=relevant.map(c=>esc2(c.doc)).filter((x,i,a)=>a.indexOf(x)===i).slice(0,4).join('<br>');
    return '<p><b>Encontré reglas directamente relacionadas con el caso:</b></p><ul>'+blocks+'</ul><p class="darwen-note"><b>Fuentes:</b><br>'+sources+'</p><p class="darwen-note">Darbot no encontró suficiente capacidad de síntesis externa en este equipo para unir estas reglas en una conclusión única. No usar una coincidencia ajena al caso como respuesta.</p>';
  }

  function darwenAnswer(q){
    const conversational=darwenSmallTalk(q); if(conversational)return conversational;
    const complex=darbotIsComplexCase(q);
    const rq=darwenResolvedQuery(q);
    if(!complex){
      const trainingDirect=darwenDirectTrainingAnswer(q); if(trainingDirect)return trainingDirect;
      const smartManual=darwenSmartManualAnswer(q); if(smartManual)return smartManual;
      const manualDirect=darwenDirectManualAnswer(rq); if(manualDirect)return manualDirect;
      const peasDirect=darwenDirectPeasAnswer(rq); if(peasDirect)return peasDirect;
    }
    const {intent,cards}=miniSourceCards(rq); const best=cards[0]; const checklist=miniChecklist(intent).slice(0,4);
    if(complex){ const localComplex=darbotLocalComplexAnswer(rq,cards); if(localComplex)return localComplex; }
    const direct=directFactAnswer(rq,cards); if(direct)return direct;
    if(!best) return '<p>Fuente no encontrada</p>';
    return '<p>Respuesta no encontrada</p>';
  }
  async function darwenApiAnswer(q){
    const conversational=darwenSmallTalk(q); if(conversational)return conversational;
    const complex=darbotIsComplexCase(q);
    const rq=darwenResolvedQuery(q);
    if(!complex){
      const trainingDirect=darwenDirectTrainingAnswer(q); if(trainingDirect)return trainingDirect;
      const smartManual=darwenSmartManualAnswer(q); if(smartManual)return smartManual;
      const manualDirect=darwenDirectManualAnswer(rq); if(manualDirect)return manualDirect;
      const peasDirect=darwenDirectPeasAnswer(rq); if(peasDirect)return peasDirect;
    }
    const analysis=darbotCollectEvidence(rq);
    const {intent,cards,facets,variants}=analysis;
    if(!complex){ const direct=directFactAnswer(q,cards); if(direct)return direct; }
    if(!cards.length) return '<p>Fuente no encontrada</p>';
    const evidence=cards.slice(0,14).map((c,i)=>({
      prioridad:i+1,
      tipo:c.label,
      codigo_tipo:c.type,
      titulo:c.title,
      detalle:clean(c.text||'').slice(0,1400),
      fuente:c.doc,
      enlace:c.url||'',
      score:Math.round(c.score||0)
    }));
    const token=sessionStorage.getItem('iafas_hub_api_token_v1')||'';
    const res=await fetch('/api/darwen-chat',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':token},body:JSON.stringify({message:rq,intent:intent.label,facets,queries:variants,evidence,history:darbotRecentHistory(8),reasoning:{mode:'deliberate',crossCheck:true,maxEvidence:14,askWhenAmbiguous:true}})});
    const payload=await res.json().catch(()=>({ok:false,error:'Respuesta inválida'}));
    if(!res.ok||payload.ok===false)throw new Error(payload.error||'No se pudo consultar la IA.');
    const rawAnswer=String(payload.answer||'Respuesta no encontrada').replace(/^\s*respuesta\s+directa\s*:\s*/i,'');
    const safeAnswer=esc2(rawAnswer).replace(/\n/g,'<br>');
    const evidenceCount=payload.evidenceCount||evidence.length;
    return `<p>${safeAnswer}</p>${payload.source==='openai'?`<p class="darwen-note">Darbot contrastó ${evidenceCount} fuente(s) internas del Hub para elaborar esta respuesta.</p>`:''}`;
  }
  window.openDarwenChat=function(){
    const chat=$id('darwenChat'); if(!chat)return;
    chat.classList.add('open'); if($id('darwenLauncher'))$id('darwenLauncher').classList.add('hidden');
    darwenEnsureGreeting(); setTimeout(()=>{$id('darwenInput')?.focus();},80);
  };
  window.resetDarwenChat=function(){
    const box=$id('darwenMessages'); if(box)box.innerHTML='';
    window.speechSynthesis?.cancel?.();
    darwenStopTalking();
    darbotConversation.turns=[];darbotConversation.lastSocial='';darbotConversation.lastUser='';
    darwenEnsureGreeting();
  };
  window.minimizeDarwenChat=function(){
    const chat=$id('darwenChat'); if(chat)chat.classList.remove('open');
    if($id('darwenLauncher'))$id('darwenLauncher').classList.remove('hidden');
  };
  window.darwenQuick=function(text){
    openDarwenChat(); const input=$id('darwenInput'); if(input){input.value=text; input.focus();}
  };
  window.sendDarwenMessage=async function(event){
    if(event)event.preventDefault();
    const input=$id('darwenInput'); const q=clean(input?.value||''); if(!q)return;
    darwenAddMessage('user',esc2(q)); darbotRemember('user',q); input.value='';
    const typing=darwenTyping();
    const delay=Math.min(1500,650+q.length*12);
    setTimeout(async()=>{
      let answer='';
      try{answer=await darwenApiAnswer(q);}catch(_e){answer=darwenAnswer(q);}
      darwenRemoveTyping(typing);
      darwenAddMessage('bot',answer); darbotRemember('assistant',darwenPlainText(answer));
      darwenSpeak(answer);
    },delay);
  };
  let darwenRecognition=null;
  let darwenVoiceText='';
  let darwenVoiceSilenceTimer=null;
  let darwenVoiceHardStopTimer=null;
  function darwenClearVoiceTimers(){
    clearTimeout(darwenVoiceSilenceTimer);
    clearTimeout(darwenVoiceHardStopTimer);
    darwenVoiceSilenceTimer=null;
    darwenVoiceHardStopTimer=null;
  }
  function darwenPolishTranscript(raw){
    let t=clean(raw||'');
    if(!t)return '';
    t=t.replace(/\b(signo de interrogacion|signo de interrogación)\b/gi,'?')
       .replace(/\b(signo de exclamacion|signo de exclamación)\b/gi,'!')
       .replace(/\bpunto y coma\b/gi,';')
       .replace(/\bdos puntos\b/gi,':')
       .replace(/\bcoma\b/gi,',')
       .replace(/\bpunto\b/gi,'.');
    t=t.replace(/\s+([,.;:?!])/g,'$1').replace(/([,.;:?!])(?=\S)/g,'$1 ');
    t=t.replace(/\s+(pero|aunque|sin embargo)\s+/gi,', $1 ')
       .replace(/\s+(ademas|además|entonces|luego|despues|después)\s+/gi,'. $1, ');
    t=t.replace(/\s{2,}/g,' ').trim();
    const n=norm(t);
    const looksQuestion=/^(que|qué|como|cómo|cuando|cuándo|donde|dónde|cual|cuál|cuanto|cuánto|por que|por qué|si|necesita|requiere|debo|puedo|tengo que)\b/.test(n)
      || /\b(que debo|qué debo|que hago|qué hago|necesita|requiere|se cubre|esta cubierto|está cubierto|que diagnostico|qué diagnostico)\b/.test(n);
    if(looksQuestion && !/[?]$/.test(t)) t='¿'+t.replace(/^¿/,'').replace(/[.]$/,'')+'?';
    t=t.replace(/^([a-záéíóúñ])/i,m=>m.toUpperCase())
       .replace(/([.!?]\s+)([a-záéíóúñ])/gi,(_m,a,b)=>a+b.toUpperCase());
    return t;
  }

  window.toggleDarwenVoice=function(){
    openDarwenChat();
    darwenEnsureVoiceStage();
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    const input=$id('darwenInput');
    if(!SpeechRecognition){darwenAddMessage('bot','<p>La opción de voz depende del navegador. Usa Google Chrome o Microsoft Edge, abre el portal con el servidor local y permite acceso al micrófono.</p>');return;}
    if(darwenRecognition){darwenClearVoiceTimers();darwenRecognition.stop();darwenRecognition=null;document.body.classList.remove('darwen-listening');darwenVoiceStatus('Escucha detenida.');return;}
    darwenVoiceText='';
    darwenRecognition=new SpeechRecognition();
    darwenRecognition.lang=(navigator.language&&navigator.language.toLowerCase().startsWith('es'))?navigator.language:'es-PE';
    darwenRecognition.interimResults=true;
    darwenRecognition.continuous=false;
    darwenRecognition.maxAlternatives=1;
    darwenRecognition.onstart=()=>{
      document.body.classList.add('darwen-listening');
      darwenVoiceStatus('Micrófono activo. Habla ahora.');
      darwenVoiceHardStopTimer=setTimeout(()=>{try{darwenRecognition?.stop();}catch(_e){}},10000);
    };
    darwenRecognition.onaudiostart=()=>darwenVoiceStatus('Audio detectado. Sigue hablando.');
    darwenRecognition.onspeechstart=()=>darwenVoiceStatus('Voz detectada. Te escucho...');
    darwenRecognition.onspeechend=()=>darwenVoiceStatus('Procesando lo que dijiste...');
    darwenRecognition.onresult=e=>{
      let transcript='';
      for(let i=e.resultIndex||0;i<e.results.length;i++) transcript+=' '+(e.results[i]?.[0]?.transcript||'');
      transcript=clean(transcript);
      if(transcript){
        darwenVoiceText=transcript;
        const preview=darwenPolishTranscript(transcript);
        if(input){input.value=preview; input.focus();}
        darwenVoiceStatus('Te escuché: '+preview);
        clearTimeout(darwenVoiceSilenceTimer);
        darwenVoiceSilenceTimer=setTimeout(()=>{try{darwenRecognition?.stop();}catch(_e){}},1400);
      }
    };
    darwenRecognition.onerror=e=>{
      darwenClearVoiceTimers();
      document.body.classList.remove('darwen-listening');
      const code=e?.error||'desconocido';
      const reason=code==='not-allowed'||code==='service-not-allowed'
        ?'No tengo permiso para usar el micrófono. Actívalo en el navegador y vuelve a intentar.'
        :code==='no-speech'
          ?'No detecté voz. Pulsa el micrófono y habla después de ver "Micrófono activo".'
          :`No pude tomar el audio con claridad. Error del navegador: ${code}.`;
      darwenAddMessage('bot',`<p>${esc2(reason)}</p>`);
      darwenVoiceStatus(reason);
    };
    darwenRecognition.onend=()=>{
      darwenClearVoiceTimers();
      darwenRecognition=null;
      document.body.classList.remove('darwen-listening');
      const text=darwenPolishTranscript(input?.value||darwenVoiceText);
      if(text){
        if(input)input.value=text;
        darwenVoiceStatus('Consulta interpretada y enviada.');
        setTimeout(()=>window.sendDarwenMessage(),80);
      }else{
        darwenVoiceStatus('No detecté voz. Toca el micrófono e intenta otra vez.');
      }
    };
    try{darwenRecognition.start();}
    catch(_e){darwenClearVoiceTimers();document.body.classList.remove('darwen-listening');darwenRecognition=null;darwenVoiceStatus('No pude iniciar el micrófono. Cierra y vuelve a abrir el chat.');}
  };
  window.toggleDarwenSpeech=function(){
    openDarwenChat();
    darwenEnsureVoiceStage();
    darwenSpeechEnabled=!darwenSpeechEnabled;
    document.body.classList.toggle('darwen-voice-mode',darwenSpeechEnabled);
    document.body.classList.toggle('darwen-speech-on',darwenSpeechEnabled);
    if(!darwenSpeechEnabled){window.speechSynthesis?.cancel?.();darwenStopTalking();darwenVoiceStatus('Voz desactivada.');}
    else{
      const msg=darwenGreeting();
      if(!darwenVoiceGreetingDone){
        darwenVoiceGreetingDone=true;
        const box=$id('darwenMessages');
        if(!box?.children?.length) darwenAddMessage('bot',msg);
      }
      darwenSpeak(msg);
    }
  };
  document.addEventListener('keydown',e=>{
    if(e.key==='Enter' && !e.shiftKey && e.target && e.target.id==='darwenInput'){e.preventDefault(); window.sendDarwenMessage(e);}
  });
  window.syncVersion=function(){ const el=document.querySelector('.app-version'); if(el)el.textContent='IAFAS HUB v4.2.35 · DARWEN RESPUESTA DIRECTA 0818'; };
  setTimeout(()=>{try{window.syncVersion();}catch(e){}},50);
})();
