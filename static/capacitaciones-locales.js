window.CAPACITACIONES_LOCALES=[];
window.CAPACITACIONES_QA=[...(window.CAPACITACIONES_QA||[]).filter(x=>!window.CAPACITACIONES_LOCALES.some(y=>y.id===x.id)),...window.CAPACITACIONES_LOCALES];
