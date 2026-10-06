import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ariaApi } from '@/api/client'
import { getStoriesByLensTag, UNDER_EDITORIAL_REVIEW, type AriaPattern, type SectorCode } from '@/lib/story-content'
import { SECTOR_NAMES_EN, getNewsTypeColor } from '@/lib/constants'
import { PageFooter } from '@/components/layout/PageFooter'
import { PlanaMasthead } from '@/components/journalists/PlanaMasthead'
import { PlanaLeadBlock } from '@/components/journalists/PlanaLeadBlock'
import { PlanaDesk } from '@/components/journalists/PlanaDesk'
import { PlanaColofon } from '@/components/journalists/PlanaColofon'
import type { PlanaStory } from '@/components/journalists/plana-parts'

// ---------------------------------------------------------------------------
// INVESTIGATIONS — hardcoded editorial metadata (the front page's story set)
// ---------------------------------------------------------------------------

type FraudType = 'ghost_company' | 'procurement_fraud' | 'embezzlement' | 'monopoly' | 'overpricing'
type StatusKind = 'procesado' | 'auditado' | 'reporteado' | 'solo_datos'
type Era = 'pena' | 'amlo' | 'cross' | 'sheinbaum'

interface Investigation {
  slug: string
  headline: string
  headline_es?: string
  sub: string
  sub_es?: string
  type: FraudType
  status: StatusKind
  amount: number
  era: Era
  contracts: number
  brief: string
  brief_es?: string
  yearSpan?: string
}

// Lead = the direct-award story (no model in it); off-lead = a cross-era story.
const LEAD_SLUG = 'marea-de-adjudicaciones'
const OFFLEAD_SLUG = 'captura-institucional'

const ALL_INVESTIGATIONS: Investigation[] = [
  {
    slug: 'el-sexenio-del-riesgo',
    headline: 'The Ledger of Five Administrations',
    headline_es: 'El libro mayor de cinco sexenios',
    sub: 'EPN 9.32% · AMLO 9.38% · Sheinbaum 9.56% · v0.8.5',
    sub_es: 'EPN 9.32% · AMLO 9.38% · Sheinbaum 9.56% · v0.8.5',
    type: 'procurement_fraud',
    status: 'reporteado',
    amount: 2758,
    era: 'cross',
    contracts: 1050552,
    yearSpan: '2002–2025',
    brief: "The risk indicator stepped up once, between Calderón and Peña Nieto, and has been flat since. Set aside the contracts the model learned from and Peña Nieto, López Obrador and Sheinbaum sit within about 0.3 points of each other: 9.32%, 9.38%, 9.56%. What changed under López Obrador was how money was awarded: more direct awards by value, fewer single-award procedures.",
    brief_es: 'El indicador de riesgo subió una sola vez, entre Calderón y Peña Nieto, y desde entonces está plano. Sin los contratos de los que aprendió el modelo, Peña Nieto, López Obrador y Sheinbaum quedan a unos 0.3 puntos entre sí: 9.32%, 9.38%, 9.56%. Lo que cambió con López Obrador fue cómo se adjudicó el dinero: más adjudicación directa por valor y menos procedimientos con un solo adjudicado.',
  },
  {
    slug: 'el-vacio',
    headline: 'Mexico Stopped Publishing Its Contracts as Data. We Rebuilt 98,290 Procedures From the Portal.',
    headline_es: 'México dejó de publicar sus contratos como datos. Reconstruimos 98,290 procedimientos desde el portal.',
    sub: 'ComprasMX gap · 78.3% direct award',
    sub_es: 'Hueco ComprasMX · 78.3% adjudicación directa',
    type: 'procurement_fraud',
    status: 'solo_datos',
    amount: 356.0,
    era: 'sheinbaum',
    contracts: 98290,
    yearSpan: '2025–2026',
    brief: 'CompraNet froze in September 2025, and its successor portal no longer publishes the winner and the price as data. By reverse-engineering it, RUBLI rebuilt 98,290 procedures published after the freeze — 78.3% direct awards, two in five with no amount of any kind.',
    brief_es: 'CompraNet se congeló en septiembre de 2025, y su portal sucesor ya no publica el ganador ni el precio como datos. Con ingeniería inversa, RUBLI reconstruyó 98,290 procedimientos publicados tras el congelamiento — 78.3% adjudicación directa, dos de cada cinco sin monto de ningún tipo.',
  },
  {
    slug: 'captura-institucional',
    headline: 'The Suppliers Who Cannot Leave',
    headline_es: 'Los proveedores que no pueden irse',
    sub: 'IMSS · CFE · PEMEX',
    sub_es: 'IMSS · CFE · PEMEX',
    type: 'monopoly',
    status: 'auditado',
    amount: 1077,
    era: 'cross',
    // The buyer groups carry vendor counts and value, not a contract total —
    // 0 is the card's "not applicable", and the renderer drops the line.
    contracts: 0,
    yearSpan: '2002–2025',
    brief: '15,939 companies send four fifths or more of everything they sell to a single government buyer; the average is 96%. At IMSS 3,468 of them hold 405.3 billion pesos between them — while no supplier comes close to dominating the institute in return.',
    brief_es: '15,939 empresas le venden cuatro quintas partes o más de todo lo suyo a un solo comprador de gobierno; el promedio es 96%. En el IMSS, 3,468 de ellas acumulan 405.3 mil millones de pesos — mientras ningún proveedor se acerca a dominar al instituto a cambio.',
  },
  {
    slug: 'el-cartel-de-los-vales',
    headline: 'Five Firms, a Closed Market, and a Winner That Keeps Changing',
    headline_es: 'Cinco empresas, un mercado cerrado y un ganador que no deja de cambiar',
    sub: 'Toka · Edenred · Efectivale · Si Vale · Sodexo',
    sub_es: 'Toka · Edenred · Efectivale · Si Vale · Sodexo',
    type: 'monopoly',
    status: 'auditado',
    amount: 142.6,
    era: 'cross',
    contracts: 10786,
    yearSpan: '2001–2025',
    brief: 'Five issuers hold 142.6 billion pesos of federal card contracts. 96.4% skipped an open contest; the lead changed hands three times.',
    brief_es: 'Cinco emisoras concentran 142.6 mil millones en contratos federales de tarjetas. El 96.4% no pasó por concurso abierto; el liderazgo cambió tres veces.',
  },
  {
    slug: 'el-monopolio-invisible',
    headline: 'Concentration in IMSS Medicine Purchasing',
    headline_es: 'Concentración en las compras de medicamentos del IMSS',
    sub: 'Grupo Fármacos · IMSS',
    type: 'monopoly',
    status: 'reporteado',
    amount: 133.2,
    era: 'cross',
    contracts: 6303,
    yearSpan: '2002–2025',
    brief: 'Four pharmaceutical distributors collected 326 billion pesos from IMSS over 23 years with no meaningful competition. Their combined risk indicator averages 0.96.',
    brief_es: 'Cuatro distribuidoras farmacéuticas cobraron 326 mil millones de pesos al IMSS en 23 años sin competencia significativa. Su indicador de riesgo combinado promedia 0.96.',
  },
  {
    slug: 'el-ano-de-la-emergencia',
    headline: 'The Ratchet: Four Years Without a Way Back',
    headline_es: 'El trinquete: cuatro años sin camino de regreso',
    sub: '2021–24 floor 79.1% · above every pre-2020 year',
    sub_es: 'Piso 2021–24 de 79.1% · por encima de todo año pre-2020',
    type: 'procurement_fraud',
    status: 'reporteado',
    amount: 4.5,
    era: 'amlo',
    contracts: 158319,
    yearSpan: '2020–2021',
    brief: "Mexico's COVID emergency decree let health authorities buy without a public tender — and the direct-award rate barely moved, because it was already 77.8%. Every full year from 2020 to 2024 was more direct than any year before the pandemic; the partial 2025 record is the first to fall below.",
    brief_es: 'El decreto de emergencia COVID permitió a las autoridades de salud comprar sin licitación pública — y la tasa de adjudicación directa apenas se movió, porque ya estaba en 77.8%. Cada año completo de 2020 a 2024 fue más directo que cualquier año anterior a la pandemia; el registro parcial de 2025 es el primero que queda por debajo.',
  },
  {
    slug: 'la-ilusion-competitiva',
    headline: 'Now You See Competition',
    headline_es: 'Ahora usted ve competencia',
    sub: 'Single-award "competitive" procedures',
    sub_es: 'Procedimientos «competitivos» con un solo adjudicado',
    type: 'procurement_fraud',
    status: 'reporteado',
    amount: 0,
    era: 'cross',
    contracts: 361599,
    yearSpan: '2011–2024',
    brief: 'For 14 straight years, over 45% of Mexico\'s "competitive" procurement ended with exactly one winner — 362,000 contracts, peaking at 65.65% in 2014. The EU scoreboard rates anything above 20% unsatisfactory.',
    brief_es: 'Durante 14 años seguidos, más del 45% de la contratación "competitiva" de México terminó con exactamente un ganador — 362,000 contratos, con un pico de 65.65% en 2014. El Tablero UE considera insatisfactorio todo lo que supere el 20%.',
  },
  {
    slug: 'marea-de-adjudicaciones',
    // Matches the story's own h1 (SD-09). The card and the page must not greet
    // a reader with two different titles for the same investigation.
    headline: 'The 82 Percent Rule',
    headline_es: 'La regla del 82 por ciento',
    sub: 'Every completed term worse',
    type: 'procurement_fraud',
    status: 'reporteado',
    amount: 0,
    era: 'cross',
    // Direct awards 2011–2024, as the renderer reads it.
    contracts: 1931317,
    yearSpan: '2011–2024',
    brief: '82.18% of 2023 federal contracts were awarded without a contest — the highest of the 14 full years COMPRANET codes procedure type. Each completed administration since 2011 has run higher than the last.',
    brief_es: 'El 82.18% de los contratos federales de 2023 se adjudicó sin concurso — la lectura más alta de los 14 años completos que CompraNet codifica el tipo de procedimiento. Cada administración completa ha corrido más alto que la anterior.',
  },
  {
    slug: 'el-ejercito-fantasma',
    // Matches the story's own h1 (SD-06). The card and the page must not greet
    // a reader with two different titles for the same investigation.
    headline: 'The Man Who Won 370 Million Pesos and Disappeared',
    headline_es: 'El hombre que ganó 370 millones de pesos y desapareció',
    sub: 'P2 ghost-company pattern',
    type: 'ghost_company',
    status: 'solo_datos',
    // Billions of pesos, as the renderer reads it — the P2 cohort's lifetime
    // federal contracting, 39.6B.
    amount: 39.6,
    era: 'cross',
    contracts: 0,
    yearSpan: '2002–2025',
    brief: "RUBLI identified 6,118 vendors matching ghost-company patterns across 23 years. They appear, win contracts, then vanish from the tax registry — 126 of them, 2.1%, carry SAT's definitive Article 69-B listing.",
    brief_es: 'RUBLI identificó 6,118 proveedores con patrones de empresa fantasma en 23 años. Aparecen, ganan contratos y desaparecen del registro fiscal — 126 de ellos, el 2.1%, llevan el listado definitivo del SAT bajo el Artículo 69-B.',
  },
  {
    slug: 'el-gran-precio',
    headline: 'The Contracts No One Is Watching Are the Biggest Ones',
    headline_es: 'Los contratos que nadie vigila son los más grandes',
    sub: '40 mega-contracts above 10B',
    type: 'overpricing',
    status: 'reporteado',
    amount: 0,
    era: 'cross',
    contracts: 3000000,
    yearSpan: '2002–2025',
    brief: "Across 3 million contracts, risk rises in near-lockstep with size: the 40 contracts above 10 billion pesos — 819 billion in all — are every one high-risk, and oversight runs thinnest exactly there.",
    brief_es: 'En 3 millones de contratos, el riesgo sube casi en paralelo con el tamaño: los 40 contratos por encima de 10 mil millones — 819 mil millones en total — son todos de alto riesgo, y la fiscalización es más débil justo ahí.',
  },
  {
    slug: 'la-industria-del-intermediario',
    // Matches the story's own h1 (SD-05). The card and the page must not
    // greet a reader with two different titles for the same investigation.
    headline: 'Follow the Middleman',
    headline_es: 'Sigan al intermediario',
    sub: 'P3 pass-through vendors',
    type: 'procurement_fraud',
    status: 'solo_datos',
    // Billions of pesos, as the renderer reads it — the P3 cohort's lifetime
    // federal contracting, 556.5B.
    amount: 556,
    era: 'cross',
    contracts: 0,
    yearSpan: '2002–2025',
    brief: '2,972 vendors match the pass-through pattern and hold 556.5 billion pesos between them. But more than half the money at the top of that list has already been reviewed and ruled out — and 2,691 of the 2,972 have never been opened at all.',
    brief_es: '2,972 proveedores coinciden con el patrón de paso y acumulan 556.5 mil millones de pesos. Pero más de la mitad del dinero de la cima de esa lista ya fue revisado y descartado — y 2,691 de los 2,972 no se han abierto nunca.',
  },
  {
    slug: 'el-umbral-de-los-300k',
    headline: 'The Prices That End in Zeros',
    headline_es: 'Los precios que terminan en ceros',
    sub: 'Contracts written on round numbers',
    type: 'overpricing',
    status: 'solo_datos',
    amount: 0,
    era: 'cross',
    // Contracts in the 200K-400K band written on an exact multiple of 10,000.
    contracts: 22263,
    yearSpan: '2002–2025',
    brief: '22,263 contracts between 200,000 and 400,000 pesos are written on an exact multiple of ten thousand — up to 29 times the count a thousand pesos to either side. 81.5% of them were awarded without a contest, against 70.8% of the band.',
    brief_es: '22,263 contratos de 200 mil a 400 mil pesos están escritos sobre un múltiplo exacto de diez mil — hasta 29 veces el conteo a mil pesos de cualquier lado. El 81.5% se adjudicó sin competencia, contra el 70.8% de la banda.',
  },
  {
    slug: 'volatilidad-el-precio-del-riesgo',
    headline: "The Smoking Gun Is a Number",
    headline_es: 'La pistola humeante es un número',
    sub: 'Strongest predictor · v0.8.5',
    type: 'overpricing',
    status: 'solo_datos',
    amount: 0,
    era: 'cross',
    contracts: 3051294,
    yearSpan: '2002–2025',
    brief: "Price volatility is the single strongest predictor in RUBLI's risk model (coefficient +0.558), outperforming 17 other features. It captures the forensic fingerprint of negotiated — not competed — prices.",
    brief_es: 'La volatilidad de precios es el predictor más fuerte del modelo de RUBLI (coeficiente +0.558), por encima de otros 17 factores. Captura la huella forense de precios negociados, no competidos.',
  },
]

const INVESTIGATIONS = ALL_INVESTIGATIONS.filter((i) => !UNDER_EDITORIAL_REVIEW.has(i.slug))

const TYPE_LABEL: Record<FraudType, { en: string; es: string }> = {
  ghost_company: { en: 'Ghost companies', es: 'Empresas fantasma' },
  procurement_fraud: { en: 'Procurement', es: 'Contratación' },
  embezzlement: { en: 'Embezzlement', es: 'Desvío de recursos' },
  monopoly: { en: 'Market capture', es: 'Captura de mercado' },
  overpricing: { en: 'Overpricing', es: 'Sobreprecio' },
}

// Distance-to-consequence ladder — drives the agate rubric's ink weight + order.
const STATUS_RANK: Record<StatusKind, PlanaStory['statusRank']> = {
  procesado: 'consequence',
  auditado: 'consequence',
  reporteado: 'reported',
  solo_datos: 'lead',
}
const RANK_ORDER: Record<PlanaStory['statusRank'], number> = { consequence: 0, reported: 1, lead: 2 }

// i18n fallbacks (keys live in journalists.json; these guard against a missing key).
const STATUS_FALLBACK: Record<StatusKind, { en: string; es: string }> = {
  procesado: { en: 'PROSECUTED', es: 'PROCESADO' },
  auditado: { en: 'UNDER AUDIT', es: 'BAJO AUDITORÍA' },
  reporteado: { en: 'REPORTED', es: 'REPORTADO' },
  solo_datos: { en: 'DATA LEAD', es: 'PISTA DE DATOS' },
}
const ERA_FALLBACK: Record<Era, { en: string; es: string }> = {
  pena: { en: 'EPN · 2012–2018', es: 'EPN · 2012–2018' },
  amlo: { en: 'AMLO · 2018–2024', es: 'AMLO · 2018–2024' },
  cross: { en: 'CROSS-ERA', es: 'MULTI-SEXENIO' },
  sheinbaum: { en: 'SHEINBAUM · 2024–', es: 'SHEINBAUM · 2024–' },
}

// ---------------------------------------------------------------------------
// AriaLiveTicker — the wire desk. Count + link only: no vendor names here,
// because tier 1 is a model output, not an investigation.
// ---------------------------------------------------------------------------

function AriaLiveTicker({ lang }: { lang: 'en' | 'es' }) {
  const { data } = useQuery({
    queryKey: ['aria', 'journalists-ticker'],
    queryFn: () => ariaApi.getQueue({ tier: 1, per_page: 1 }),
    staleTime: 5 * 60 * 1000,
  })

  const total = data?.pagination?.total ?? 0
  if (total === 0) return null

  return (
    <section aria-label={lang === 'es' ? 'Cola de ARIA' : 'ARIA queue'} className="mt-16 pt-8 border-t border-border">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-text-muted">
          {lang === 'es' ? '§ EL CABLE · ARIA T1' : '§ THE WIRE · ARIA T1'}
        </span>
        <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-text-secondary tabular-nums">
          {total.toLocaleString('en-US')}{' '}
          {lang === 'es'
            ? 'proveedores con las puntuaciones más altas del indicador de riesgo (salida del modelo, no una investigación)'
            : 'vendors with the highest risk-indicator scores (model output, not an investigation)'}
        </span>
        <span className="h-px flex-1 bg-background-elevated" />
        <Link
          to="/aria"
          className="inline-flex items-center min-h-11 sm:min-h-6 text-[11px] font-mono font-bold uppercase tracking-[0.14em] transition-colors hover:opacity-80 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          style={{ color: 'var(--color-accent-text)' }}
        >
          {lang === 'es' ? 'Ver la cola de ARIA →' : 'Open the ARIA queue →'}
        </Link>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Main page — «La Primera Plana»: the newsroom prints its own front page
// ---------------------------------------------------------------------------

export default function Journalists() {
  const { t, i18n } = useTranslation('journalists')
  const [searchParams, setSearchParams] = useSearchParams()
  const lang: 'en' | 'es' = i18n.language.startsWith('es') ? 'es' : 'en'
  const isEs = lang === 'es'

  // Cross-surface lens filter (from the Atlas)
  const lensPattern = searchParams.get('pattern') as AriaPattern | null
  const lensSector = searchParams.get('sector') as SectorCode | null
  const lensFilterActive = !!(lensPattern || lensSector)
  const lensFilteredSlugs = useMemo(() => {
    if (!lensFilterActive) return null
    return new Set(
      getStoriesByLensTag({ pattern: lensPattern ?? undefined, sector: lensSector ?? undefined }).map((s) => s.slug),
    )
  }, [lensPattern, lensSector, lensFilterActive])

  // Status counts drive the masthead thesis + the colophon (all computed, none hardcoded).
  const counts = useMemo(() => {
    const c = { total: INVESTIGATIONS.length, procesado: 0, auditado: 0, reporteado: 0, soloDatos: 0 }
    for (const inv of INVESTIGATIONS) {
      if (inv.status === 'procesado') c.procesado++
      else if (inv.status === 'auditado') c.auditado++
      else if (inv.status === 'reporteado') c.reporteado++
      else c.soloDatos++
    }
    return c
  }, [])

  // Map one investigation to the localized shape the front-page parts render.
  const toPlana = (inv: Investigation, withContracts: boolean): PlanaStory => ({
    slug: inv.slug,
    headline: isEs ? inv.headline_es ?? inv.headline : inv.headline,
    brief: isEs ? inv.brief_es ?? inv.brief : inv.brief,
    color: getNewsTypeColor(inv.type),
    typeLabel: isEs ? TYPE_LABEL[inv.type].es : TYPE_LABEL[inv.type].en,
    statusLabel: t(`status.${inv.status}`, { defaultValue: isEs ? STATUS_FALLBACK[inv.status].es : STATUS_FALLBACK[inv.status].en }),
    statusRank: STATUS_RANK[inv.status],
    eraLabel: t(`eraLabel.${inv.era}`, { defaultValue: isEs ? ERA_FALLBACK[inv.era].es : ERA_FALLBACK[inv.era].en }),
    contractsLabel:
      withContracts && inv.contracts > 0
        ? `${inv.contracts.toLocaleString('en-US')} ${isEs ? 'CONTRATOS' : 'CONTRACTS'}`
        : null,
  })

  // Partition (lens-filtered subset when a lens is active).
  const shownInvs = useMemo(
    () => (lensFilteredSlugs ? INVESTIGATIONS.filter((i) => lensFilteredSlugs.has(i.slug)) : INVESTIGATIONS),
    [lensFilteredSlugs],
  )
  const leadInv = shownInvs.find((i) => i.slug === LEAD_SLUG) ?? shownInvs[0] ?? null
  const offLeadInv = shownInvs.find((i) => i.slug === OFFLEAD_SLUG && i.slug !== leadInv?.slug) ?? null
  const restInvs = shownInvs
    .filter((i) => i.slug !== leadInv?.slug && i.slug !== offLeadInv?.slug)
    .sort((a, b) => RANK_ORDER[STATUS_RANK[a.status]] - RANK_ORDER[STATUS_RANK[b.status]])

  const leadPlana = leadInv ? toPlana(leadInv, true) : null
  const offLeadPlana = offLeadInv ? toPlana(offLeadInv, true) : null
  const restPlana = restInvs.map((i) => toPlana(i, false))
  const allShownPlana = shownInvs.map((i) => toPlana(i, false))

  const clearLens = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('pattern')
    next.delete('sector')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* ── Masthead / folio ── */}
        <PlanaMasthead lang={lang} counts={counts} />

        {/* ── Lens filter pill (from the Atlas) ── */}
        {lensFilterActive && (
          <div className="mt-6 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">◆ {isEs ? 'Desde el Atlas:' : 'From the Atlas:'}</span>
            <button
              type="button"
              onClick={clearLens}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold tracking-[0.12em] rounded-sm border border-risk-high/40 text-risk-high bg-risk-high/[0.06] hover:bg-risk-high/[0.12] transition-colors"
            >
              {lensPattern && <span>PATTERN · {lensPattern}</span>}
              {lensSector && <span>SECTOR · {SECTOR_NAMES_EN[lensSector]?.toUpperCase() ?? lensSector.toUpperCase()}</span>}
              <span className="opacity-60" aria-hidden="true">·</span>
              <span className="opacity-80">{isEs ? 'QUITAR' : 'CLEAR'} ✕</span>
            </button>
          </div>
        )}

        {/* ── The stories ── */}
        {shownInvs.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-border rounded-sm mt-8">
            <p className="text-sm font-mono text-text-muted">
              {isEs ? 'Ninguna investigación coincide con este filtro.' : 'No investigations match this filter.'}
            </p>
          </div>
        ) : lensFilterActive ? (
          // Filtered mode — tiers collapse to one flat register (avoids half-empty tiers)
          <div className="mt-2">
            <PlanaDesk stories={allShownPlana} lang={lang} filtered />
          </div>
        ) : (
          <>
            {leadPlana && <PlanaLeadBlock lead={leadPlana} offLead={offLeadPlana} lang={lang} />}
            <PlanaDesk stories={restPlana} lang={lang} />
          </>
        )}

        {/* ── The wire (ARIA ticker, kept) ── */}
        <AriaLiveTicker lang={lang} />

        {/* ── Atlas band (kept, Day-13 copy) ── */}
        <div
          className="mt-14 sm:mt-16 py-4 px-5 flex items-center gap-4 rounded-sm border border-border hover:border-border-hover transition-colors"
          style={{ background: 'var(--color-background-card)' }}
        >
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] flex-shrink-0" style={{ color: 'var(--color-accent)' }} aria-hidden="true">◆</span>
          <p className="text-[12px] font-mono text-text-secondary flex-1 min-w-0">
            <span className="font-bold text-text-primary">{isEs ? 'El Atlas' : 'The Atlas'}</span>
            {' — '}
            {isEs ? 'un mapa vivo de cúmulos de proveedores por escala y riesgo.' : 'a live scatter of vendor clusters by scale and risk indicator.'}
          </p>
          <Link to="/atlas" className="flex-shrink-0 inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-[0.14em] transition-colors hover:opacity-80 whitespace-nowrap" style={{ color: 'var(--color-accent)' }}>
            {isEs ? 'Explorar →' : 'Explore →'}
          </Link>
        </div>

        {/* ── Fe de plana (editor's note) ── */}
        <PlanaColofon lang={lang} total={counts.total} procesadoCount={counts.procesado} />

        <PageFooter />
      </div>
    </div>
  )
}
