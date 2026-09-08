// Matriz Consolidada de Exclusiones IAFAS 2026
// Fuente: 01-Matriz_Consolidada_Exclusiones_IAFAS_2026-1-.docx
(function(){
  window.EXCLUSIONES_IAFAS = [
    {
      id:'EXC-COM-001',
      tipo:'Exclusion comun',
      grupo:'Estetica y procedimientos no recuperativos',
      iafas:'Rimac Seguros, Rimac EPS, Pacifico Seguros, Pacifico EPS, Sanitas, La Positiva Seguros, La Positiva EPS, Mapfre Seguros, Mapfre EPS',
      resumen:'Cirugia plastica, cosmetica o suntuaria; odontologia estetica y tratamientos dentales cosmeticos; varices esteticas, alopecia, melasma y procedimientos corporales sin finalidad recuperativa.',
      regla:'Exclusion comun. Validar si existe finalidad recuperativa documentada, beneficio PEAS, condicion contractual o excepcion expresa del plan.',
      keywords:'estetica estetico cosmética cosmetica suntuaria cirugia plastica cirugia cosmetica odontologia estetica dental cosmetico carillas blanqueamiento varices esteticas alopecia melasma corporal no recuperativo liposuccion mamoplastia ginecomastia hiperhidrosis tatuajes liporeductores'
    },
    {
      id:'EXC-COM-002',
      tipo:'Exclusion comun',
      grupo:'Infertilidad, reproduccion y funcion sexual',
      iafas:'Rimac EPS, Pacifico Seguros, Pacifico EPS, Sanitas, La Positiva Seguros, La Positiva EPS, Mapfre Seguros, Mapfre EPS',
      resumen:'Estudios y tratamientos de infertilidad o fertilizacion asistida; anticoncepcion, esterilizacion y cambio de sexo segun plan; tratamientos de disfuncion erectil o libido.',
      regla:'Exclusion comun con alcance dependiente del producto. Verificar plan, beneficio especifico, continuidad legal o excepcion documentada.',
      keywords:'infertilidad fertilidad fertilizacion asistida reproduccion asistida in vitro inseminacion anticoncepcion esterilizacion vasectomia ligadura cambio de sexo disfuncion erectil libido impotencia sexual funcion sexual'
    },
    {
      id:'EXC-COM-003',
      tipo:'Exclusion comun',
      grupo:'Medicamentos de bienestar o sin necesidad medica',
      iafas:'Rimac EPS, Pacifico Seguros, Sanitas, La Positiva Seguros, La Positiva EPS, Mapfre Seguros, Mapfre EPS',
      resumen:'Energizantes, antiastenicos, anabolicos, nootropicos; suplementos, vitaminas y minerales sin deficiencia o excepcion; productos naturales, homeopaticos, glucosamina y condroitina.',
      regla:'Requiere sustento de necesidad medica, deficiencia documentada o excepcion del plan antes de considerarlo cubierto.',
      keywords:'energizante antiastenico anabolico nootropico suplemento vitamina mineral deficiencia productos naturales homeopatico homeopatia glucosamina condroitina bienestar sin necesidad medica'
    },
    {
      id:'EXC-COM-004',
      tipo:'Exclusion comun',
      grupo:'Tratamientos especificos de cobertura limitada',
      iafas:'Segun producto: Rimac EPS; Pacifico Seguros, Pacifico EPS; Sanitas; La Positiva Seguros, La Positiva EPS; Mapfre Seguros, Mapfre EPS',
      resumen:'Obesidad y sobrepeso; alopecia y melasma; hormona de crecimiento; dependencia de alcohol, tabaco o drogas; VIH/SIDA salvo plan, PEAS o beneficio especifico.',
      regla:'Cobertura limitada o condicionada. Revisar producto, PEAS, beneficio especifico, programa y excepciones expresas.',
      keywords:'obesidad sobrepeso bariatrica alopecia melasma hormona crecimiento alcohol tabaco drogas dependencia adiccion vih sida hiv cobertura limitada peas beneficio especifico'
    },
    {
      id:'EXC-COM-005',
      tipo:'Exclusion comun',
      grupo:'Tecnologia, evidencia y registro',
      iafas:'Rimac Seguros, Rimac EPS, Pacifico Seguros, Pacifico EPS, Sanitas, La Positiva Seguros, La Positiva EPS, Mapfre Seguros, Mapfre EPS',
      resumen:'Medicamentos, equipos o procedimientos experimentales o sin sustento suficiente; sin aprobacion FDA/EMA o sin registro DIGEMID cuando corresponda; uso fuera de indicacion aprobada y terapias genicas o biologicas fuera de criterios.',
      regla:'No concluir cobertura si falta evidencia, aprobacion regulatoria, registro sanitario o criterio tecnico aplicable.',
      keywords:'experimental investigacional evidencia sustento fda ema digemid registro sanitario off label fuera de indicacion terapia genica biologica tecnologia nueva fase iii ahrq grade nccn'
    },
    {
      id:'EXC-COM-006',
      tipo:'Exclusion comun',
      grupo:'Equipos, protesis, ortesis y dispositivos',
      iafas:'Rimac EPS; Pacifico Seguros, Pacifico EPS; Sanitas; La Positiva Seguros, La Positiva EPS; Mapfre Seguros, Mapfre EPS',
      resumen:'Ortesis y protesis externas; audifonos e implantes cocleares; glucometros, nebulizadores, CPAP y otros equipos durables; dispositivos de columna y neuroestimulacion.',
      regla:'Verificar si el dispositivo esta expresamente cubierto, si corresponde a SCTR, continuidad, PEAS o excepcion del plan.',
      keywords:'equipo durable protesis ortesis ortesis externa protesis externa audifono implante coclear glucometro nebulizador cpap dispositivo columna neuroestimulacion retractores descartables'
    },
    {
      id:'EXC-COM-007',
      tipo:'Exclusion comun',
      grupo:'Circunstancias del evento o del afiliado',
      iafas:'Aplicacion variable en todas las IAFAS; revisar plan y excepcion',
      resumen:'Preexistencias o congenitas salvo continuidad legal, PEAS o excepcion; autolesiones con excepcion de salud mental señalada en Garantia; alcohol/drogas, deportes peligrosos, delitos, guerra o terrorismo; accidentes laborales cuando corresponde SCTR.',
      regla:'Aplicacion variable. Confirmar producto, periodo de espera, continuidad, causal del evento, SCTR y excepciones de salud mental.',
      keywords:'preexistencia congenita continuidad legal autolesion salud mental alcohol drogas deporte peligroso delito guerra terrorismo accidente laboral sctr periodo espera dosaje etilico origen evento'
    },
    {
      id:'EXC-COM-008',
      tipo:'Exclusion comun',
      grupo:'Gastos no medicos y ambito de atencion',
      iafas:'Rimac EPS; Pacifico Seguros; Sanitas; La Positiva Seguros, La Positiva EPS; Mapfre Seguros, Mapfre EPS',
      resumen:'Suite, telefono, TV, cafeteria, alimentacion o cama de acompañante; atencion en el extranjero sin beneficio contratado; chequeos o despistajes fuera del programa preventivo.',
      regla:'Validar beneficio contratado, programa preventivo, ambito territorial y condicion de hospitalizacion antes de autorizar.',
      keywords:'suite telefono tv television cafeteria alimentacion acompañante cama acompañante gasto no medico extranjero fuera del pais chequeo despistaje preventivo programa preventivo ambito atencion'
    },
    {
      id:'EXC-IAFA-001',
      tipo:'Regla particular',
      grupo:'Rimac Seguros',
      iafas:'Rimac Seguros',
      resumen:'Never events no facturables; la IPRESS asume la reparacion del daño. Servicios fuera del CPM deben facturarse por PPS. Reglas particulares para polizas de accidentes o estudiantes.',
      regla:'Distinguir evento adverso, CPM, PPS y tipo de poliza antes de facturar o responder.',
      keywords:'rimac seguros never events evento adverso no facturable ipress reparacion daño cpm pps accidentes estudiantes poliza accidentes'
    },
    {
      id:'EXC-IAFA-002',
      tipo:'Regla particular',
      grupo:'Rimac EPS',
      iafas:'Rimac EPS',
      resumen:'Criterios especificos de evidencia AHRQ/GRADE. Oncologia sujeta a NCCN y conclusion satisfactoria de Fase III. Medicamentos del extranjero limitados en planes de cobertura nacional.',
      regla:'En tecnologia o oncologia, validar criterio de evidencia, NCCN, Fase III y alcance nacional/internacional del plan.',
      keywords:'rimac eps ahrq grade oncologia nccn fase iii medicamento extranjero cobertura nacional evidencia'
    },
    {
      id:'EXC-IAFA-003',
      tipo:'Regla particular',
      grupo:'Pacifico Seguros',
      iafas:'Pacifico Seguros',
      resumen:'Cirugia robotica e insumos asociados excluidos segun Lista A revisada. Lista B contiene excepciones y criterios de autorizacion. Compra de sangre u organos y determinados estudios geneticos tienen reglas propias.',
      regla:'Validar Lista A/B, autorizacion y regla particular para robotica, insumos, sangre, organos o estudios geneticos.',
      keywords:'pacifico seguros cirugia robotica robotica insumos lista a lista b autorizacion sangre organos compra sangre compra organos estudios geneticos genetica'
    },
    {
      id:'EXC-IAFA-004',
      tipo:'Regla particular',
      grupo:'Pacifico EPS',
      iafas:'Pacifico EPS',
      resumen:'Diferenciar condicion PEAS y plan complementario. Oxigeno hiperbarico, toxina botulinica y resonancia magnetica multiparametrica dependen de necesidad medica. Anteojos, autolesiones y congenitas tienen escenarios normativos especificos.',
      regla:'Separar PEAS de plan complementario y sustentar necesidad medica o escenario normativo aplicable.',
      keywords:'pacifico eps peas plan complementario oxigeno hiperbarico toxina botulinica botox resonancia magnetica multiparametrica rm multiparametrica anteojos autolesiones congenitas necesidad medica'
    },
    {
      id:'EXC-IAFA-005',
      tipo:'Regla particular',
      grupo:'Sanitas',
      iafas:'Sanitas',
      resumen:'Preexistencias de capa compleja. Quantiferon y Pneumobact no se cubren como rutina y requieren informe. DIU puede cubrir colocacion, no necesariamente el dispositivo.',
      regla:'Validar informe, indicacion y si la cobertura corresponde al procedimiento, al dispositivo o a ambos.',
      keywords:'sanitas preexistencias capa compleja quantiferon pneumobact rutina informe diu dispositivo colocacion diu'
    },
    {
      id:'EXC-IAFA-006',
      tipo:'Regla particular',
      grupo:'La Positiva Seguros',
      iafas:'La Positiva Seguros',
      resumen:'Ortesis pueden cubrirse en polizas SCTR. Psicofarmacos admiten excepciones preanestesicas, hospitalarias cortas o anticonvulsivantes. Ecografia 3D/4D puede admitirse en maternidad PEAS.',
      regla:'Verificar SCTR, indicacion hospitalaria/preanestesica, anticonvulsivante o maternidad PEAS segun corresponda.',
      keywords:'positiva seguros la positiva seguros ortesis sctr psicofarmacos preanestesico hospitalaria corta anticonvulsivante ecografia 3d 4d maternidad peas'
    },
    {
      id:'EXC-IAFA-007',
      tipo:'Regla particular',
      grupo:'La Positiva EPS',
      iafas:'La Positiva EPS',
      resumen:'Exclusiones diagnosticas especificas: elastografia de mama, actigrafia, acelerometria y score de calcio. Restricciones para retractores descartables y determinados usos de medicina nuclear. Excepciones vinculadas a PEAS o programas especificos.',
      regla:'Validar si aplica exclusion diagnostica, restriccion de insumo o excepcion PEAS/programa.',
      keywords:'positiva eps la positiva eps elastografia mama actigrafia acelerometria score calcio retractores descartables medicina nuclear peas programas especificos'
    },
    {
      id:'EXC-IAFA-008',
      tipo:'Regla particular',
      grupo:'Garantia de Salud',
      iafas:'Garantia de Salud',
      resumen:'Exclusion expresa N80.8 otras endometriosis. Periodo de espera de 10 meses para preexistencias, cirugias y hospitalizacion segun plan. Restricciones de zona y seguridad para medico a domicilio. Estancia posterior al alta no cubierta; urgencia/emergencia domiciliaria no aplica. Autolesiones derivadas de salud mental no se excluyen segun fuente.',
      regla:'Revisar diagnostico N80.8, periodo de espera, zona, medico a domicilio, estancia posterior al alta y excepcion de salud mental.',
      keywords:'garantia de salud n80.8 endometriosis otras endometriosis periodo espera 10 meses preexistencias cirugias hospitalizacion medico domicilio zona seguridad estancia posterior alta urgencia domiciliaria emergencia domiciliaria autolesiones salud mental'
    },
    {
      id:'EXC-IAFA-009',
      tipo:'Regla particular',
      grupo:'Mapfre Seguros',
      iafas:'Mapfre Seguros',
      resumen:'Sangre, plasma, albumina, paquetes globulares y pruebas de compatibilidad señalados como no cubiertos. Procedimientos minimamente invasivos de columna y magnetoterapia. Dosaje etilico y origen del evento son relevantes para la evaluacion.',
      regla:'Validar componente sanguineo, procedimiento de columna, magnetoterapia, dosaje etilico y origen del evento.',
      keywords:'mapfre seguros sangre plasma albumina paquetes globulares pruebas compatibilidad columna minimamente invasivo magnetoterapia dosaje etilico origen evento'
    },
    {
      id:'EXC-IAFA-010',
      tipo:'Regla particular',
      grupo:'Mapfre EPS',
      iafas:'Mapfre EPS',
      resumen:'Restricciones expresas para hiperhidrosis, ginecomastia, mamoplastia, diastasis, tatuajes y metodos liporeductores. PEAS contempla excepciones congenitas especificas. Acupuntura, podiatria y atencion fuera del pais figuran en exclusiones revisadas.',
      regla:'Validar restriccion expresa, excepcion PEAS congenita y ambito de atencion antes de concluir.',
      keywords:'mapfre eps hiperhidrosis ginecomastia mamoplastia diastasis tatuajes liporeductores congenitas peas acupuntura podiatria fuera del pais extranjero'
    }
  ];
})();
