# Comunicado de Prensa

**PARA PUBLICACIÓN INMEDIATA**

---

## RUBLI: plataforma de código abierto detecta patrones de riesgo de corrupción en 3 millones de contratos federales mexicanos

**Herramienta gratuita cruza datos públicos de COMPRANET, SAT y SFP para señalar contratos de alto riesgo en el gasto público federal 2002–2025**

---

MÉXICO — RUBLI (rubli.xyz), una plataforma de análisis de contratación pública desarrollada como proyecto independiente de código abierto, pone a disposición de periodistas, investigadores y ciudadanía un sistema automatizado de detección de patrones de riesgo en **3,058,286 contratos federales mexicanos** celebrados entre 2002 y 2025, con un valor total de aproximadamente **9.9 billones de pesos**.

La plataforma aplica un modelo estadístico sobre los datos públicos de COMPRANET para identificar contratos con características asociadas a irregularidades documentadas: empresas fantasma, monopolización de proveedores, fraccionamiento de contratos, sobreprecios, redes de co-licitación y abuso de la adjudicación directa.

**Hallazgos principales**

- **11.0% de los contratos puntuados presenta indicadores de alto riesgo** — un umbral de priorización que RUBLI fijó para caer dentro de su propia meta de calibración (2–15%); no es una referencia de la OCDE ni una estimación de cuánta contratación es corrupta. **5.0% (152,010 contratos) alcanza el nivel de riesgo crítico**, con características estadísticamente similares a las de contratos de casos etiquetados como la red de empresas fantasma del IMSS, Segalmex y las compras de emergencia por COVID-19.

- **299 proveedores en el Nivel 1 (T1)** — todos ya forman parte de la base de casos de RUBLI, por lo que el nivel confirma casos conocidos — y 1,488 en el nivel T2, donde empiezan las pistas nuevas, según el sistema de priorización ARIA, que cruza las puntuaciones de riesgo con registros externos: **13,960 empresas del listado definitivo de EFOS del SAT** (facturación de operaciones simuladas) y **2,395 registros** del registro de proveedores sancionados de la SFP.

- **Cerca de 1.04 billones de pesos** en contratos de 448 proveedores nombrados en 389 casos con fuente de prensa, registros oficiales o auditoría, dentro de la ventana temporal de cada caso. Es valor contratado ligado a casos documentados, no una estimación de desvío.

"El modelo se entrenó con la base de casos etiquetados de RUBLI: 1,401 casos en ese momento. La mayoría son pistas que el propio sistema detectó y que un analista documentó; 389 de los 1,427 casos actuales provienen de prensa, registros oficiales o auditorías, y casi ninguno es una resolución judicial", explica el equipo de RUBLI. "No reemplaza la investigación periodística: indica dónde mirar. Una puntuación alta significa que un contrato comparte características estadísticas con casos conocidos de irregularidades. No es prueba de nada. Es una herramienta para priorizar la investigación en un universo de más de tres millones de contratos que ningún equipo podría revisar manualmente."

El modelo de riesgo (versión 0.8.5) es una sola regresión logística global con regularización ElasticNet y corrección PU-learning. Con proveedores añadidos a la base de casos después del entrenamiento, el área bajo la curva ROC es de **0.656** (0.733 dentro de muestra), en una escala donde 0.5 es azar y 1 es discriminación perfecta. El AUC de prueba de 0.785 reportado originalmente no pudo reproducirse y ya no se cita.

**Acceso y metodología**

RUBLI es de uso completamente gratuito en rubli.xyz, sin necesidad de registro. El código fuente está disponible bajo licencia Apache 2.0 en github.com/rodanaya/rubli. La metodología completa, los coeficientes del modelo y sus limitaciones conocidas están documentados públicamente en la propia plataforma (sección Metodología).

Periodistas e investigadores pueden consultar perfiles individuales de proveedores, historiales de contratación por dependencia, visualizaciones de redes de co-licitación y la lista de investigación priorizada (ARIA) directamente desde el sitio.

**Limitaciones importantes**

Las puntuaciones de riesgo son indicadores estadísticos, no determinaciones de responsabilidad. La plataforma solo tiene acceso a los datos de adjudicación registrados en COMPRANET, no a la ejecución de los contratos. La calidad de los datos varía según el periodo: los registros de 2002 a 2010 tienen cobertura muy limitada de RFC. El registro federal quedó congelado el 28 de septiembre de 2025 tras la desaparición de CompraNet; RUBLI recuperó de forma independiente 94,899 adjudicaciones posteriores, publicadas de manera fragmentada (sección «El Apagón»).

---

**Contacto**

Plataforma: rubli.xyz
Código fuente: github.com/rodanaya/rubli
Correo: rubli-project@proton.me

*RUBLI es un proyecto independiente de código abierto orientado a la transparencia en la contratación pública. No recibe financiamiento de partidos políticos ni de dependencias gubernamentales.*
