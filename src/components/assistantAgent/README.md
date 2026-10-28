# Agente SCM de solo lectura

Esta carpeta contiene el panel real acotado del agente SCM y su esfera visual. `vendor/Strands.jsx` y `vendor/Strands.css` se copiaron del componente aprobado del catálogo local; el shader se conserva byte a byte (`Strands.jsx` SHA-256 `038B945191DC9721CD292751F424EB0C704C3C4C17F7B395ADDE7F5BBDB5DBEB`). No se afirma una licencia adicional para Strands.

El panel solo consulta el estado y conversa mediante `scmAgentApi.js`. Mantiene historial en memoria, aborta la espera HTTP con `AbortController` sin afirmar cancelación remota y deja adjuntos deshabilitados hasta que exista un contrato backend. No incluye fuentes, reportes, descargas ni propuestas inventadas.
