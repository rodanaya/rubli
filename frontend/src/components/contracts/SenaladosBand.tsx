/**
 * SenaladosBand — "LOS SEÑALADOS / THE FLAGGED": the editorial band that leads
 * /contracts (El Archivo). Shows the most-concerning contracts matching the
 * CURRENT filter — labelled cases first, then high+critical risk —
 * named, sourced, each linking to its full dossier.
 *
 * Honesty rules (folio): a non-accusatory framing line; an explicit calm state
 * when nothing is flagged (never dress low-risk rows as alarming); hidden during
 * a free-text search (the band is for filter/preset browsing, not lookup).
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ScrollText } from 'lucide-react'
import { contractApi } from '@/api/client'
import type { ContractFilterParams, ContractListItem } from '@/api/types'
import { EntityIdentityChip } from '@/components/ui/EntityIdentityChip'
import { VerdictSeal } from './VerdictSeal'
import { cn, formatCompactMXN, toTitleCase } from '@/lib/utils'
import { SECTORS, RISK_TEXT_COLORS, RISK_INK_ON_PLATE, getSectorTextColor } from '@/lib/constants'
import { parseFactorLabel, getFactorCategoryColor, getFactorCategoryTextColor } from '@/lib/risk-factors'
import { cleanContractDescription } from '@/lib/contract-audit'

// ---------------------------------------------------------------------------
// Shared bits (reused by ContractRow)
// ---------------------------------------------------------------------------

/** Documented-case seal — strong-evidence GT contract tied to a named scandal. */
export function CaseSeal({
  contract,
  lang,
  className,
}: {
  contract: Pick<ContractListItem, 'is_documented_case' | 'case_slug' | 'case_name_es' | 'case_name_en'>
  lang: string
  className?: string
}) {
  if (!contract.is_documented_case || !contract.case_slug) return null
  const name =
    (lang === 'es' ? contract.case_name_es : contract.case_name_en) ||
    contract.case_name_en ||
    contract.case_name_es ||
    ''
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border border-risk-critical/40 bg-risk-critical/10 px-1.5 py-0.5 text-[12px] font-medium',
        className,
      )}
      style={{ color: RISK_TEXT_COLORS.critical }}
      title={
        lang === 'es'
          ? 'Aparece en un caso etiquetado — un vínculo, no prueba de delito.'
          : 'Appears in a labelled case — a link, not proof of a crime.'
      }
    >
      <ScrollText className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap">
        {lang === 'es' ? 'Caso etiquetado' : 'Labelled case'}
      </span>
      {name && (
        <>
          <ArrowRight className="h-2.5 w-2.5 shrink-0 opacity-60" aria-hidden="true" />
          <EntityIdentityChip type="case" id={contract.case_slug} name={name} size="sm" fullName />
        </>
      )}
    </span>
  )
}

/** Why-flagged strip: top risk factors + procurement seals + anomaly tick. */
export function WhyFlags({
  contract,
  lang,
  max = 2,
  className,
}: {
  contract: ContractListItem
  lang: string
  max?: number
  className?: string
}) {
  // Drop factor tokens already represented by the DA / single-bid seals below,
  // so a row doesn't show "Direct Award" (factor) AND "Direct award" (seal).
  const DA_SB = /(direct[_\s]?award|single[_\s]?bid|licitante|adjudicaci)/i
  const factors = (contract.risk_factors ?? []).filter(Boolean).filter((f) => !DA_SB.test(f))
  const shown = factors.slice(0, max)
  const extra = factors.length - shown.length
  const seals: { key: string; label: string; tone: string; ink: string }[] = []
  if (contract.is_direct_award)
    seals.push({
      key: 'da',
      label: lang === 'es' ? 'Adj. directa' : 'Direct award',
      tone: 'border-risk-high/40 bg-risk-high/10',
      ink: RISK_INK_ON_PLATE.high,
    })
  if (contract.is_single_bid)
    seals.push({
      key: 'sb',
      label: lang === 'es' ? 'Licitante único' : 'Single bidder',
      tone: 'border-risk-critical/40 bg-risk-critical/10',
      ink: RISK_TEXT_COLORS.critical,
    })
  const anomalous = (contract.mahalanobis_distance ?? 0) > 20

  if (shown.length === 0 && seals.length === 0 && !anomalous) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {shown.map((raw) => {
        const parsed = parseFactorLabel(raw)
        const color = getFactorCategoryColor(parsed.category)
        const ink = getFactorCategoryTextColor(parsed.category)
        return (
          <span
            key={raw}
            className="rounded-sm border px-1 py-0.5 text-[12px] font-medium"
            style={{ backgroundColor: `${color}14`, color: ink, borderColor: `${color}30` }}
            title={raw}
          >
            {parsed.label}
          </span>
        )
      })}
      {seals.map((s) => (
        <span
          key={s.key}
          className={cn('rounded-sm border px-1 py-0.5 text-[12px] font-medium', s.tone)}
          style={{ color: s.ink }}
        >
          {s.label}
        </span>
      ))}
      {anomalous && (
        <span
          className="rounded-sm border border-risk-high/40 bg-risk-high/10 px-1 py-0.5 text-[12px] font-medium tabular-nums"
          style={{ color: RISK_INK_ON_PLATE.high }}
          title={
            lang === 'es'
              ? `Anomalía multivariada (D²=${contract.mahalanobis_distance?.toFixed(1)})`
              : `Multivariate anomaly (D²=${contract.mahalanobis_distance?.toFixed(1)})`
          }
        >
          △ D²
        </span>
      )}
      {extra > 0 && (
        <span className="text-[12px] text-text-muted">
          {lang === 'es' ? `+${extra} más` : `+${extra} more`}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The band
// ---------------------------------------------------------------------------

const ENUM_UNIT: Record<string, { es: string; en: string }> = {
  paquete: { es: 'paquetes', en: 'packages' },
  partida: { es: 'partidas', en: 'items' },
  lote: { es: 'lotes', en: 'lots' },
}

/** Band-only title policy (PARALLAX D12 § judge 1): a long objeto that
 *  enumerates packages / partidas / lotes (or a `;` list) prints its lead
 *  clause plus a computed count; anything else stays in full. Table rows and
 *  the dossier keep the full objeto. */
function bandTitle(objeto: string, lang: string): { lead: string; suffix: string | null } {
  if (objeto.length <= 160) return { lead: objeto, suffix: null }
  const labelled = [...objeto.matchAll(/\b(paquete|partida|lote)s?\s+(?:["“]([a-z0-9]{1,3})["”]|([a-z]|\d{1,3})\b)/gi)]
  const labels = new Set(labelled.map((m) => (m[2] ?? m[3]).toLowerCase()))
  const parts = objeto.split(';').map((p) => p.trim()).filter(Boolean)
  const n = labels.size >= 2 ? labels.size : parts.length >= 2 ? parts.length : 0
  const cut = objeto.search(/[:;]/)
  if (!n || cut <= 0) return { lead: objeto, suffix: null }
  const unit = labels.size >= 2
    ? ENUM_UNIT[labelled[0][1].toLowerCase()]
    : { es: 'partes', en: 'parts' }
  return { lead: objeto.slice(0, cut).trim(), suffix: `${n} ${lang === 'es' ? unit.es : unit.en}` }
}

function SenaladoEntry({
  contract,
  rank,
  lang,
}: {
  contract: ContractListItem
  rank: number
  lang: string
}) {
  const { t: ts } = useTranslation('sectors')
  const sector = contract.sector_id ? SECTORS.find((s) => s.id === contract.sector_id) : null
  const title =
    cleanContractDescription(contract.title || '', Infinity).objeto ||
    contract.contract_number ||
    (lang === 'es' ? `Contrato #${contract.id}` : `Contract #${contract.id}`)
  const { lead, suffix } = bandTitle(title, lang)
  // The title is the entry's one link; its ::after stretches over the whole
  // entry (relative) so a click anywhere opens the dossier. Chips and the
  // seal sit above it at z-10 — no nested anchors, no role=link div.
  return (
    <div
      className="group relative grid grid-cols-[auto_1fr_auto] items-start gap-x-4 gap-y-1 border-b border-border/60 px-1 py-2.5 transition-colors last:border-b-0 hover:bg-background-elevated/40"
    >
      <span className="pt-0.5 font-mono text-[13px] tabular-nums text-text-muted">
        {String(rank).padStart(2, '0')}
      </span>

      <div className="min-w-0">
        <p className="break-words text-sm font-medium text-text-primary group-hover:text-accent">
          <Link
            to={`/contracts/${contract.id}`}
            state={{ from: 'archive' }}
            className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            {lead}
          </Link>
          {suffix && (
            <span className="font-mono text-[12px] font-normal text-text-muted"> · {suffix}</span>
          )}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
          {contract.vendor_id ? (
            <span className="relative z-10">
              <EntityIdentityChip type="vendor" id={contract.vendor_id} name={contract.vendor_name || ''} size="sm" fullName />
            </span>
          ) : (
            <span className="truncate">{toTitleCase(contract.vendor_name || '—')}</span>
          )}
          {contract.institution_id && (
            <>
              <ArrowRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />
              <span className="relative z-10">
                <EntityIdentityChip
                  type="institution"
                  id={contract.institution_id}
                  name={contract.institution_name || ''}
                  size="sm"
                  fullName
                />
              </span>
            </>
          )}
          {sector && (
            <span className="font-medium" style={{ color: getSectorTextColor(sector.code) }}>
              · {ts(sector.code)}
            </span>
          )}
          {contract.contract_date && (
            <span className="font-mono tabular-nums">· {contract.contract_date.slice(0, 7)}</span>
          )}
        </div>
        <div className="relative z-10 mt-1 flex flex-wrap items-center gap-1.5">
          <CaseSeal contract={contract} lang={lang} />
          <WhyFlags contract={contract} lang={lang} max={2} />
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 text-right">
        <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">
          {formatCompactMXN(contract.amount_mxn)}
        </span>
        <VerdictSeal score={contract.risk_score} level={contract.risk_level} align="right" className="relative z-10" />
      </div>
    </div>
  )
}

export function SenaladosBand({
  filters,
  lang,
}: {
  filters: ContractFilterParams
  lang: string
}) {
  const { t } = useTranslation('contracts')
  const active = !filters.search // hidden during free-text search

  const { data, isLoading } = useQuery({
    queryKey: ['contracts-highlights', filters],
    queryFn: () => contractApi.getHighlights(filters, 4),
    staleTime: 2 * 60 * 1000,
    enabled: active,
  })

  if (!active) return null
  const items = (data ?? []).slice(0, 4)

  return (
    <section
      className="rounded-sm border border-border bg-background-card"
      aria-label={t('senalados.kicker', 'The flagged')}
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-border/60 px-4 py-2">
        <div className="flex items-baseline gap-2">
          <ScrollText className="h-3.5 w-3.5 self-center text-risk-high" aria-hidden="true" />
          <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.16em] text-text-primary">
            {t('senalados.kicker', 'THE FLAGGED')}
          </h2>
        </div>
        <p className="hidden text-[12px] leading-tight text-text-muted sm:block">
          {t('senalados.honesty', 'Flagged by the model and labelled cases — not an accusation.')}
        </p>
      </header>

      <div className="px-3">
        {isLoading ? (
          <div className="space-y-2 py-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-background-elevated/60" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-text-muted">
            {t('senalados.empty', 'No standout flags in this filter.')}
          </p>
        ) : (
          items.map((c, i) => <SenaladoEntry key={c.id} contract={c} rank={i + 1} lang={lang} />)
        )}
      </div>
    </section>
  )
}
