---
spec_phase: approved
delivery_state: review
functional_validation: qa_green
ux_validation: provisional
physical_uat: not_required
release_constraint: no_habilitar_en_planta
---

# OF excepcional: selección inicial de variantes

Autorización: petición explícita del usuario de precargar las piezas-color al seleccionar una pieza para producir, sin crear ni liberar automáticamente la OF. Implementación local aislada, sin push, despliegue ni datos productivos.

## Alcance y decisión de integración

En la base FE `f97ad810a6486f628ce679b1cb695139190da67f`, el alta excepcional se realiza por **molde**; no existe un selector independiente de pieza. El molde contiene las piezas activas y sus variantes. Se conserva esa entrada y se precargan sus colores al elegirlo. Un molde multipieza sigue produciendo todas sus salidas por color: no se crea una OF por pieza ni se omiten coproductos.

BE `931e2b711c2b7e519fb2c680619366cdf93a4a77` permanece intacto, incluida la corrección de cierre OF74. No cambia C66, contratos API, base de datos, liberación, OF planificadas ni edición de OF existentes. La duplicación conserva los objetivos de la fuente.

## Contrato de interacción

- Una selección nueva toma una sola vez los colores únicos de variantes activas de formas activas; excluye molde inactivo y colores conocidos inactivos. Los IDs numéricos y textuales equivalentes se deduplican.
- Cada objetivo empieza con kg vacíos. Puede usar únicamente el default maestro APROBADO compatible existente; no crea receta ni inventa meta. La advertencia de receta pendiente y el bloqueo de liberación siguen vigentes.
- Un color aún ausente del catálogo queda identificado por su ID con advertencia; no permite guardar hasta resolverlo. Un artículo o coproducto faltante/inactivo se muestra como configuración pendiente, sin fabricación ficticia.
- El usuario puede quitar objetivos y editar metas. El último objetivo se conserva como fila editable; se puede limpiar su color. Duplicar manualmente un color sigue bloqueando guardar.
- Elegir el mismo molde no vuelve a precargar. Actualizar catálogos o habilitar un color conserva objetivos, exclusiones y metas; no vuelve a agregar variantes quitadas.
- Cambiar/limpiar el molde con objetivos preparados pide confirmación de sustitución. Cancelar mantiene selección y metas, incluso el texto visible del selector. Confirmar prepara objetivos nuevos con metas vacías.
- Las respuestas de moldes anteriores o de una apertura anterior se ignoran. Se bloquea editar objetivos mientras cambia el molde. Cerrar y reabrir reinicia el borrador en memoria.
- Receta seleccionada retirada: advertencia y bloqueo. Ruta seleccionada: esperar su consulta; si desaparece, retirar referencia explícitamente o elegir otra. Sin ruta se conserva el flujo autorizado con proceso explícito, incluso sin RUTA_VER; el backend conserva la autoridad de validación.
- Crear y liberar son acciones explícitas separadas. Se mantiene el intento idempotente y el bloqueo ante resultado de creación incierto.

Información primaria: colores y metas por producir. Acción primaria: Crear OF en borrador, habilitada solo con datos válidos. Espera: carga del molde/rutas; listo: objetivos editables; error: mensaje y recuperación contextual; éxito: callback existente de creación. Seleccionar un molde nunca llama a crear/liberar.

## Réplica y migración Odoo

Este es un contrato de comportamiento, no una implementación de API/ORM de Odoo. Antes de implementarlo allí, mapear y verificar los maestros locales de pieza, variante, molde, receta aprobada y ruta.

1. Implementar defaults en el borrador de alta excepcional, con una marca de inicialización por selección y sesión. No usar un recálculo continuo que reconstruya las líneas ante cualquier refresco.
2. Preservar identidad de variante y deduplicación por color de campaña; en molde multipieza conservar coproductos y las validaciones de composición vigentes.
3. Mantener kg nulos hasta entrada humana. No copiar una meta de otra pieza, inventar recetas ni activar variantes inactivas para completar la selección.
4. Advertir configuración pendiente con referencias verificables; mantener guardado en borrador y liberación separados conforme al dominio. No relajar autorización ni validaciones servidor.
5. Hacer explícito el descarte al cambiar pieza/molde. Conservar exclusiones manuales y metas frente a catálogos tardíos; invalidar respuestas de selecciones/aperturas anteriores.
6. Replicar los casos de aceptación siguientes antes de migrar usuarios. No transformar este incremento en edición masiva de OF históricas ni reparación de datos.

## Recibo y evidencia técnica

Worktree: `task-5/frontend-of`, rama `codex/of-excepcional-variantes-20261006`. Backend de referencia: `task-5/backend-of`, sin cambios.

Archivos de producto: `ExceptionalFabricationOrderDialog.jsx`, `exceptionalColorDefaults.js`. Pruebas: `ExceptionalFabricationOrderDialog.spec.jsx`, `ExceptionalColorDefaults.spec.js`. Harness sin escrituras: `qa/exceptional-color-defaults.html` y `.jsx` (todos los GET interceptados con datos sintéticos, cualquier otro método rechazado).

BASELINE: 30 pruebas del formulario verdes. RED: la nueva prueba de dos variantes falló por ausencia de «Color del objetivo 2». GREEN final: **67/67 pruebas**, tres archivos, 104.64 s: `npm run test:run -- src/tests/ExceptionalFabricationOrderDialog.spec.jsx src/tests/ExceptionalColorDefaults.spec.js src/tests/FabricationOrdersScm.spec.jsx`. Evidencia: [tests](qa-of-excepcional/tests.txt), [lint](qa-of-excepcional/lint.txt), [build](qa-of-excepcional/build.txt). `npm run lint` sin errores; dos warnings fuera del incremento (`ColoresRecetasAdmin`, `OtMangasScm`). `npm run build` correcto, con warning de tamaño de bundle existente. Se reutilizaron dependencias locales mediante junction; no se ejecutó instalación de dependencias. No hay script `typecheck` ni proyecto TypeScript; no se afirma comprobación de tipos independiente.

Revisión independiente `/root/review_of`, perfil solicitado Sol High: corrigió restauración de métricas antiguas durante habilitación, opciones de molde sin refrescar, receta retirada invisible, aviso duplicado y guardia de recarga de rutas seleccionadas. Dictamen final: **sin hallazgos funcionales bloqueantes**, tras contrastar diff, 67/67 pruebas, lint, build y capturas actualizadas. Modelo/esfuerzo efectivos no verificables; configuración no equivale a evidencia runtime. Sin escaladas de razonamiento; consumo atribuible no disponible.

Capturas sintéticas: [escritorio 1280×1000](qa-of-excepcional/desktop.png) y [móvil 390×844](qa-of-excepcional/mobile.png), escala de dispositivo 1, estado desplazado a objetivos, metas vacías y receta pendiente. Revisión heurística: etiquetas, quitar objetivo y acciones inferiores visibles, campos apilados en móvil, sin solapamiento observado. No acredita primera impresión humana ni UAT. El navegador integrado falló al iniciar el sandbox ACL; se usó Chromium headless aislado sobre localhost.

## Guion de aceptación humana pendiente

Con datos de prueba y rol autorizado:

1. Seleccionar pieza/molde con varios colores: verificar que aparecen todos los esperados una sola vez, sin kg ni creación.
2. Quitar un color e introducir metas distintas; refrescar catálogos y volver a elegir el mismo molde: confirmar que no reaparece el color ni cambian metas.
3. Cambiar molde: cancelar y verificar conservación; repetir y confirmar sustitución con metas vacías.
4. Simular carga tardía, catálogo fallido, variantes vacías/inactivas y receta/ruta pendiente: entender el problema y su recuperación sin suponer producción.
5. Cancelar/reabrir: confirmar borrador limpio. Guardar únicamente tras revisar variantes/metas; confirmar BORRADOR y ninguna liberación automática.

Preguntas al planificador: ¿reconoce qué colores se producirán?, ¿puede quitar uno y ajustar kg sin ayuda?, ¿entiende qué se descarta al cambiar molde?, ¿distingue configuración pendiente de catálogo vacío?, ¿distingue crear borrador de liberar? Respuestas aún pendientes. No se inventó un dispositivo de planta representativo.

Límites: pruebas API mockeadas y QA visual sintética; sin pruebas físicas, PostgreSQL, hardware ni UAT productiva. No se ejecuta suite completa de módulos ajenos por ser cambio acotado sin contratos nuevos. Coordinador del incremento debe incorporar este recibo en la bóveda y registrar evento `scm` en `project_journal` al integrar; se evita modificar archivos globales compartidos con el worker TV.

Siguiente paso: integrar el commit FE, revalidar la composición con el trabajo TV y obtener aceptación operativa antes de habilitar en planta. No requiere commit BE ni migración de datos.
