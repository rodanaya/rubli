# RUBLI — Technical One-Pager / Ficha Tecnica
## rubli.xyz | github.com/rodanaya/rubli | Apache 2.0

---

## QUE HACE EL MODELO / WHAT THE MODEL DOES

**ES:** RUBLI (modelo v0.8.5, corrida CAL-v8-202605020212, 2 de mayo de 2026) aplica una sola regresion logistica global con regularizacion ElasticNet sobre 21 indicadores estandarizados (puntuaciones Z) calculados a nivel de contrato y proveedor; 18 tienen peso distinto de cero. Cada indicador se normaliza respecto a la media y desviacion estandar del sector y año correspondiente, de modo que un contrato de adjudicacion directa en Defensa (donde es la norma) no recibe la misma penalizacion que uno en Educacion (donde es la excepcion). El modelo produce una puntuacion entre 0 y 1 que refleja similitud estadistica con contratos de casos etiquetados. No es una probabilidad de corrupcion.

**EN:** RUBLI (model v0.8.5, run CAL-v8-202605020212, May 2, 2026) applies a single global ElasticNet logistic regression over 21 standardized (z-score) indicators computed at the contract and vendor level; 18 carry non-zero weight. Each indicator is normalized against the sector-year mean and standard deviation, so a direct award in Defense (where it is the norm) is not penalized the same as one in Education (where it is the exception). The model produces a score from 0 to 1 reflecting statistical similarity to contracts in labelled cases. It is not a probability of corruption.

**Coeficientes mas grandes / Largest coefficients:**
- `price_volatility` — varianza del tamaño de contratos del proveedor vs. norma sectorial (coef. +0.558)
- `institution_diversity` — pese al nombre, es un indice de concentracion institucional (HHI): los proveedores de un solo comprador puntuan MAS BAJO. Va en contra del patron de captura; limitacion conocida (coef. -0.388)
- `price_ratio` — monto del contrato / mediana sectorial (coef. +0.358)
- `vendor_concentration` — participacion de mercado del proveedor en su sector (coef. +0.327)
- `cobid_herfindahl` — concentracion de relaciones de co-licitacion (coef. +0.272)
- `recency_z` — dias desde el contrato anterior del proveedor; contratar con frecuencia sube la puntuacion (coef. -0.247)

**Arquitectura:** un solo modelo global; las diferencias entre sectores entran por la normalizacion Z por sector y año. Correccion PU-learning (Elkan & Noto 2008), c=0.32. No se publican intervalos de confianza por contrato.

---

## VALIDACION / VALIDATION METHODOLOGY

| Metrica | Valor |
|---|---|
| Casos etiquetados (ground truth) | 1,427 hoy (1,401 al entrenar): 363 de prensa, 25 de registros oficiales, 1 de auditoria, 989 pistas surgidas del modelo o de ARIA y documentadas por analistas. La mayoria no son resoluciones. |
| AUC-ROC fuera de muestra | 0.656 — 103,889 contratos de 694 proveedores vinculados a un caso despues del entrenamiento |
| AUC-ROC dentro de muestra | 0.733 — todos los contratos de casos etiquetados, nivel contrato |
| AUC de prueba reportado originalmente | 0.785 — no pudo reproducirse (la particion no se guardo); ya no se cita |
| Tasa de alto riesgo | 10.95% (meta de calibracion propia de RUBLI: 2-15%; no es un rango de la OCDE) |
| Contratos riesgo critico (≥0.60) | 152,010 (4.98%) |

Casos de prensa usados en entrenamiento incluyen: IMSS (red de empresas fantasma), Segalmex, compras COVID-19, La Estafa Maestra, Odebrecht-PEMEX, Grupo Higa/Casa Blanca.

---

## FUENTES DE DATOS / DATA SOURCES

| Fuente | Registros | Uso |
|---|---|---|
| COMPRANET (SE) | 3,051,294 contratos puntuados 2002-2025 | Base principal de analisis |
| SAT EFOS (Art. 69-B definitivo) | 13,960 empresas | Cruce para deteccion de factureras |
| SFP — Sistema de Proveedores Sancionados | 2,395 registros | Bandera de inhabilitados (coincidencia por nombre salvo que ambos lados tengan RFC) |

---

## LIMITACIONES CONOCIDAS / KNOWN LIMITATIONS (importantes para citar correctamente)

1. **Fraude en ejecucion es invisible.** RUBLI analiza datos de adjudicacion (COMPRANET). No tiene acceso a informacion sobre ejecucion: sobreprecios durante obra, trabajadores fantasma, sustitucion de materiales. Infraestructura y construccion estan sistematicamente subestimados.

2. **Correlacion no es causalidad.** Una puntuacion alta indica similitud estadistica con patrones conocidos. No es determinacion de responsabilidad ni prueba de conducta ilicita.

3. **Etiquetas de entrenamiento provienen de escandalos de alto perfil.** El modelo detecta bien patrones similares a casos publicos (IMSS, Segalmex). Puede no detectar corrupcion de pequeña escala o con mecanismos distintos.

4. **Calidad de datos varia por periodo.** Los registros 2002-2010 tienen cobertura de RFC de 0.1%. Los puntajes de ese periodo son menos confiables.

5. **No hay identificacion definitiva de proveedores.** El mismo proveedor puede aparecer bajo multiples grafias en distintos años.

---

## ACCESO TECNICO / TECHNICAL ACCESS

- Interfaz web: **rubli.xyz**
- Explorador de API: **rubli.xyz/api-explorer**
- Codigo fuente: **github.com/rodanaya/rubli** (Apache 2.0)
- Documentacion metodologica: **rubli.xyz** (seccion Metodologia)
