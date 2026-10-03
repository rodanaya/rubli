/**
 * RiskExplainer — "Why This Score?" explainer cards for each risk factor
 *
 * Based on Section 15.1 of RUBLI_TECHNICAL_SPEC.md.
 * Literature basis: XAI (Explainable AI) research + OECD AI principles.
 * The Romania study (Fazekas et al.) found simple explanations increased
 * journalist and policymaker adoption of algorithmic risk tools.
 *
 * Components:
 *   RiskFactorBadge   — inline badge with hover/click explainer card
 *   RiskFactorTable   — tabular display of all 16 factors (for Glossary/Methodology pages)
 *   RiskFactorCard    — standalone card for a single factor
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BookOpen, TrendingUp, TrendingDown, Minus, FlaskConical } from 'lucide-react'

// ---------------------------------------------------------------------------
// FACTOR_EXPLANATIONS — evidence base for 16 of the 21 v0.8.5 features (coefficients synced 2026-09-30)
// ---------------------------------------------------------------------------

export interface FactorExplanation {
  title: string
  coefficient: number
  direction: 'positive' | 'negative' | 'neutral'
  mechanism: string
  theory: string
  citation: string
  rubli_note: string
}

export const FACTOR_EXPLANATIONS: Record<string, FactorExplanation> = {
  vendor_concentration: {
    title: 'Market Concentration',
    coefficient: 0.3269,
    direction: 'positive',
    mechanism:
      "When one vendor captures a disproportionate share of an institution's contracts, it suggests either a legitimate monopoly or exclusive access through corruption. Ghost company networks captured >90% of institutional spending in labelled cases.",
    theory:
      'Principal-Agent Theory (Klitgaard 1988): Monopoly power is the primary enabling condition for procurement corruption — it eliminates price competition and reduces the ability to compare against market rates.',
    citation: 'Fazekas & Kocsis (2020), British Journal of Political Science',
    rubli_note:
      'v0.8.5 coefficient +0.327 (large; rank 4 of 18 non-zero features by magnitude). A higher value raises the score.',
  },
  price_volatility: {
    title: 'Price Volatility',
    coefficient: 0.5576,
    direction: 'positive',
    mechanism:
      "Vendors whose contract amounts vary wildly relative to sector norms are inconsistent with normal market pricing. Either they are winning contracts far above or below market rates depending on the occasion — a sign of discretionary pricing rather than competitive markets.",
    theory:
      'Rent-Seeking Theory (Tullock 1967): Rents are extracted through price inflation above competitive levels. Porter & Zona (1993): Price manipulation is detectable in bid distributions — colluding firms show unusual variance patterns.',
    citation: 'Porter & Zona (1993): Price manipulation detectable in bid distributions',
    rubli_note:
      'v0.8.5 coefficient +0.558 (large; rank 1 of 18 non-zero features by magnitude). A higher value raises the score.',
  },
  institution_diversity: {
    title: 'Institution Concentration (HHI)',
    coefficient: -0.3881,
    direction: 'negative',
    mechanism:
      'Herfindahl index of how concentrated a vendor\'s business is across buying institutions: high when one institution accounts for most of it. Captured vendors typically sit at the high end.',
    theory:
      'Competition Theory (Coviello & Mariniello 2014): Competition and transparency reduce award concentration. Vendors serving many buyers have more accountability exposure and less ability to corrupt all of them simultaneously.',
    citation: 'Coviello & Mariniello (2014): Competition and transparency reduce award concentration',
    rubli_note:
      'v0.8.5 coefficient -0.388, 2nd-largest of 21. Despite its name this feature is a Herfindahl index of institution concentration (high when a vendor sells to few institutions), so single-buyer vendors score LOWER. That runs against the capture pattern; a known limitation under review.',
  },
  win_rate: {
    title: 'Win Rate',
    coefficient: 0.0,
    direction: 'neutral',
    mechanism:
      "A vendor's win rate far above the sector baseline could be suspicious or legitimate depending on context. In Mexico's expanded ground truth, high win rates are not a strong discriminator — some legitimate market-dominant vendors have high win rates.",
    theory:
      'Bid-Ring Theory (Conley & Decarolis 2016): Bid rings are detectable via win pattern analysis. However, Mexico-specific analysis shows high win rates can reflect both corruption and legitimate market dominance.',
    citation: 'Conley & Decarolis (2016): Bid rings detectable via win pattern analysis',
    rubli_note:
      'Regularized to exactly zero in v0.8.5 (one of 3 of 21 features); it does not contribute to the score.',
  },
  sector_spread: {
    title: 'Sector Spread',
    coefficient: 0.0335,
    direction: 'positive',
    mechanism:
      "Vendors operating across many sectors have diversified risk exposure. However, v0.8.5 analysis shows some corruption networks intentionally operate across sectors to avoid detection. Cross-sector presence is a weak positive signal.",
    theory:
      'Extended ground truth: Some major corruption cases (LICONSA ecosystem, IMSS networks) span multiple sectors. Sector spread alone is insufficient for distinguishing corruption.',
    citation: 'RUBLI v0.8.5 ground truth analysis',
    rubli_note:
      'v0.8.5 coefficient +0.034 (small; rank 14 of 18 non-zero features by magnitude). A higher value raises the score.',
  },
  industry_mismatch: {
    title: 'Industry Mismatch',
    coefficient: -0.017,
    direction: 'neutral',
    mechanism:
      "When a vendor's primary industry doesn't match the contract sector, it suggests either a shell company (with no real operational capacity in the field) or favoritism overriding technical qualification requirements.",
    theory:
      'Shell Company Theory (Fazekas & Kocsis 2020): Ghost companies are created with generic or mismatched industry classifications to collect payments for work actually performed by the corrupt network.',
    citation: 'Fazekas & Kocsis (2020), British Journal of Political Science',
    rubli_note:
      'v0.8.5 coefficient -0.017 (small; rank 15 of 18 non-zero features by magnitude). A higher value lowers the score.',
  },
  same_day_count: {
    title: 'Same-Day Award Count',
    coefficient: 0.0142,
    direction: 'neutral',
    mechanism:
      'Multiple contracts awarded to the same vendor on the same day suggests artificial splitting of a larger contract into smaller pieces, each below the threshold requiring competitive bidding. This circumvents procurement law.',
    theory:
      'Threshold Gaming Theory (ISO 37001 Anti-Bribery): Splitting contracts to avoid competitive bidding thresholds is a documented fraud technique. The LAASSP defines specific thresholds above which public tender is mandatory.',
    citation: 'ISO 37001 Anti-Bribery Management Systems',
    rubli_note:
      'v0.8.5 coefficient +0.014 (small; rank 17 of 18 non-zero features by magnitude). A higher value raises the score.',
  },
  direct_award: {
    title: 'Direct Award (Non-Competitive)',
    coefficient: -0.0808,
    direction: 'negative',
    mechanism:
      'Contracts awarded without competitive bidding remove the market check on price and vendor quality, and maximize official discretion. Legal under certain conditions, but the absence of competition enables corruption.',
    theory:
      'Principal-Agent Theory: Discretion is the second enabling condition (after monopoly). Direct awards maximize official discretion — the awarding official can choose any vendor without justifying the choice through price competition.',
    citation: 'OECD (2016): Preventing Corruption in Public Procurement',
    rubli_note:
      'v0.8.5 coefficient -0.081 (small; rank 11 of 18 non-zero features by magnitude). A higher value lowers the score.',
  },
  ad_period_days: {
    title: 'Advertisement Period',
    coefficient: 0.0897,
    direction: 'positive',
    mechanism:
      "Days between posting a procurement opportunity and awarding the contract. Counterintuitively, known-corrupt vendors in Mexico tend to operate through normal-length procedures rather than rushed ones — the corruption happens through vendor selection, not timeline manipulation.",
    theory:
      'Transparency Theory (EU Directive 2014/24): Short advertisement periods reduce bidder participation. However, Mexico-specific data shows known-bad vendors often comply with timeline requirements while manipulating vendor selection.',
    citation: 'EU Directive 2014/24 minimum timelines',
    rubli_note:
      'v0.8.5 coefficient +0.090 (small; rank 10 of 18 non-zero features by magnitude). A higher value raises the score.',
  },
  network_member_count: {
    title: 'Network Membership',
    coefficient: 0.1663,
    direction: 'positive',
    mechanism:
      "Vendors belonging to a group of related entities (sharing addresses, legal representatives, or consistent co-bidding patterns) may be part of shell company networks or bid-rigging cartels.",
    theory:
      'Network Theory of Corruption (Wachs et al. 2021): Procurement fraud often involves coordinated networks of companies. Network membership — being connected to other vendors — is a risk signal.',
    citation: 'Fazekas, Skuhrovec & Wachs (2020): Network analysis of procurement graphs',
    rubli_note:
      'v0.8.5 coefficient +0.166 (moderate; rank 8 of 18 non-zero features by magnitude). A higher value raises the score.',
  },
  year_end: {
    title: 'Year-End Award',
    coefficient: 0.0168,
    direction: 'neutral',
    mechanism:
      "Contracts awarded in December are driven by budget-flushing pressure — agencies rush to spend remaining budget before year-end. This reduces time for due diligence and creates pressure to award quickly to familiar vendors.",
    theory:
      'Budget Cycle Theory (IMCO Mexico): Year-end budget pressure reduces oversight. Officials face career risk if they return unspent budget, creating incentive to approve contracts rapidly without full scrutiny.',
    citation: 'IMCO (Mexico): Budget rushing in December',
    rubli_note:
      'v0.8.5 coefficient +0.017 (small; rank 16 of 18 non-zero features by magnitude). A higher value raises the score.',
  },
  institution_risk: {
    title: 'Institution Risk Type',
    coefficient: -0.0342,
    direction: 'negative',
    mechanism:
      'Some government institution types have historically higher irregularity rates. Federal agencies with large procurement budgets and complex technical procurement (health supplies, IT systems) tend to have higher corruption rates than specialized agencies.',
    theory:
      'Institutional Economics: Different types of government entities have different accountability mechanisms, oversight levels, and corruption opportunities based on their procurement volumes and technical complexity.',
    citation: 'IMF CRI Methodology',
    rubli_note:
      'v0.8.5 coefficient -0.034 (small; rank 13 of 18 non-zero features by magnitude). A higher value lowers the score.',
  },
  single_bid: {
    title: 'Single Bid',
    coefficient: -0.0017,
    direction: 'neutral',
    mechanism:
      'A competitive procedure where only one vendor submitted a bid. In theory, this suggests competitors were deterred — possibly through tailored specifications, short timelines, or advance knowledge of the winner. In Mexico, this is less common because the direct award mechanism is used instead.',
    theory:
      'Competition Theory (Charron et al. 2017): Single bidding rates are among the most universally validated red flags globally. Higher rates consistently correlate with corruption perception indices across 28 EU countries.',
    citation: 'Charron et al. (2017), Journal of Politics',
    rubli_note:
      'v0.8.5 coefficient -0.002 (small; rank 18 of 18 non-zero features by magnitude). A higher value lowers the score.',
  },
  price_ratio: {
    title: 'Price Ratio',
    coefficient: 0.3579,
    direction: 'positive',
    mechanism:
      "Contract amount compared to the sector median. High price ratios could indicate overpricing. However, this simple ratio is largely absorbed by the more nuanced price_volatility feature — it's what a vendor charges on average vs. what they charge across different contracts.",
    theory:
      'Overpricing Theory (World Bank INT 2019): Warning signs of fraud include prices significantly above market rates. The IQR method identifies statistical outliers in contract amounts.',
    citation: 'World Bank INT (2019): Warning Signs of Fraud',
    rubli_note:
      'v0.8.5 coefficient +0.358 (large; rank 3 of 18 non-zero features by magnitude). A higher value raises the score.',
  },
  co_bid_rate: {
    title: 'Co-Bid Rate',
    coefficient: 0.0,
    direction: 'neutral',
    mechanism:
      'How often a vendor appears in bidding procedures together with the same partner vendors. High co-bid rates with alternating wins suggest bid rotation — a form of collusion where vendors take turns winning.',
    theory:
      'Bid-Ring Theory (Porter & Zona 1993): Co-bidding as a collusion indicator. Vendors that consistently appear together and alternate wins are likely coordinating rather than genuinely competing.',
    citation: 'Porter & Zona (1993): Co-bidding as collusion indicator',
    rubli_note:
      'Regularized to exactly zero in v0.8.5 (one of 3 of 21 features); it does not contribute to the score.',
  },
  price_hyp_confidence: {
    title: 'Price Hypothesis Confidence',
    coefficient: 0.0,
    direction: 'neutral',
    mechanism:
      "Statistical confidence that a contract amount is an outlier using Tukey's IQR method. Values beyond 1.5× the interquartile range are flagged — this measures how far beyond normal the price is.",
    theory:
      'Statistical Outlier Detection (Tukey 1977): The IQR method provides a non-parametric way to identify extreme values without assuming a normal distribution. Values beyond Q3 + 1.5×IQR are statistically unusual.',
    citation: 'Tukey IQR method for outlier detection',
    rubli_note:
      'Regularized to exactly zero in v0.8.5 (one of 3 of 21 features); it does not contribute to the score.',
  },
}

// ---------------------------------------------------------------------------
// Direction indicator
// ---------------------------------------------------------------------------

function DirectionIcon({ direction, size = 12 }: { direction: FactorExplanation['direction'], size?: number }) {
  if (direction === 'positive') return <TrendingUp size={size} className="text-risk-critical shrink-0" />
  if (direction === 'negative') return <TrendingDown size={size} className="text-risk-low shrink-0" />
  return <Minus size={size} className="text-text-muted shrink-0" />
}

// ---------------------------------------------------------------------------
// RiskFactorBadge — inline badge with hover tooltip explainer
// ---------------------------------------------------------------------------

interface RiskFactorBadgeProps {
  /** The factor key, e.g. 'vendor_concentration' */
  factor: string
  /** Optional z-score value to display */
  zScore?: number
  /** Show the full explainer panel instead of a compact tooltip */
  showExplainer?: boolean
  className?: string
}

export function RiskFactorBadge({ factor, zScore, showExplainer = false, className }: RiskFactorBadgeProps) {
  const explanation = FACTOR_EXPLANATIONS[factor]
  if (!explanation) return null

  const coeff = explanation.coefficient
  const isPositive = coeff > 0.001
  const isNegative = coeff < -0.001
  const coeffStr = isPositive ? `+${coeff.toFixed(3)}` : coeff.toFixed(3)

  const trigger = (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1 text-xs font-mono rounded px-1.5 py-0.5 border cursor-help transition-colors',
        isPositive && 'bg-risk-critical/10 border-risk-critical/30 text-risk-critical hover:bg-risk-critical/20',
        isNegative && 'bg-risk-low/10 border-risk-low/30 text-risk-low hover:bg-risk-low/20',
        !isPositive && !isNegative && 'bg-background-elevated/30 border-border text-text-muted hover:bg-background-elevated/50',
        className
      )}
      aria-label={`${explanation.title}: coefficient ${coeffStr}`}
    >
      <DirectionIcon direction={explanation.direction} size={11} />
      <span>{coeffStr}</span>
      {zScore !== undefined && (
        <span className="text-text-muted font-normal ml-0.5">z={zScore > 0 ? '+' : ''}{zScore.toFixed(1)}</span>
      )}
    </button>
  )

  if (!showExplainer) {
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm p-3 space-y-1.5">
          <p className="font-semibold text-xs">{explanation.title}</p>
          <p className="text-xs text-text-secondary leading-relaxed">{explanation.mechanism}</p>
          <p className="text-xs text-text-secondary">{explanation.citation}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return <RiskFactorCard factor={factor} trigger={trigger} />
}

// ---------------------------------------------------------------------------
// RiskFactorCard — full explainer card (popover on click)
// ---------------------------------------------------------------------------

interface RiskFactorCardProps {
  factor: string
  /** Optional custom trigger element */
  trigger?: React.ReactNode
  className?: string
}

export function RiskFactorCard({ factor, trigger, className }: RiskFactorCardProps) {
  const [open, setOpen] = useState(false)
  const explanation = FACTOR_EXPLANATIONS[factor]
  if (!explanation) return null

  const coeff = explanation.coefficient
  const coeffStr = coeff > 0.001 ? `+${coeff.toFixed(3)}` : coeff.toFixed(3)
  const isPositive = coeff > 0.001
  const isNegative = coeff < -0.001

  return (
    <div className={cn('relative inline-block', className)}>
      {/* Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="cursor-pointer"
      >
        {trigger ?? (
          <button type="button" className="text-xs underline decoration-dotted text-text-secondary hover:text-text-primary">
            {explanation.title}
          </button>
        )}
      </div>

      {/* Explainer panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className={cn(
            'absolute left-0 top-full mt-2 z-50 w-80 rounded-lg border border-border bg-background-elevated shadow-lg p-4 space-y-3',
          )}>
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-sm text-text-primary">{explanation.title}</h4>
                <span className={cn(
                  'text-xs font-mono font-bold',
                  isPositive && 'text-risk-critical',
                  isNegative && 'text-risk-low',
                  !isPositive && !isNegative && 'text-text-muted',
                )}>
                  {coeffStr} coefficient
                </span>
              </div>
              <DirectionIcon direction={explanation.direction} size={16} />
            </div>

            {/* Mechanism */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">What It Detects</p>
              <p className="text-xs text-text-secondary leading-relaxed">{explanation.mechanism}</p>
            </div>

            {/* Theory */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Theory</p>
              <p className="text-xs text-text-secondary leading-relaxed">{explanation.theory}</p>
            </div>

            {/* RUBLI note */}
            <div className="rounded bg-accent/5 border border-accent/20 px-3 py-2">
              <p className="text-xs font-semibold text-accent mb-1">In RUBLI</p>
              <p className="text-xs text-text-secondary leading-relaxed">{explanation.rubli_note}</p>
            </div>

            {/* Citation */}
            <div className="flex items-start gap-1.5 pt-1 border-t border-border/50">
              <BookOpen size={11} className="text-text-muted mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-xs text-text-secondary">{explanation.citation}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RiskFactorTable — tabular summary of all 16 factors (Glossary / Methodology)
// ---------------------------------------------------------------------------

interface RiskFactorTableProps {
  /** Show only these factors (default: all 16) */
  factors?: string[]
  className?: string
}

export function RiskFactorTable({ factors, className }: RiskFactorTableProps) {
  const keys = factors ?? Object.keys(FACTOR_EXPLANATIONS)
  // Sort by absolute coefficient descending
  const sorted = [...keys].sort((a, b) => {
    const ca = Math.abs(FACTOR_EXPLANATIONS[a]?.coefficient ?? 0)
    const cb = Math.abs(FACTOR_EXPLANATIONS[b]?.coefficient ?? 0)
    return cb - ca
  })

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-xs border-collapse" aria-label="Risk factor coefficients">
        <thead>
          <tr className="border-b border-border text-text-muted">
            <th scope="col" className="text-left py-2 pr-4 font-semibold uppercase tracking-wider">Factor</th>
            <th scope="col" className="text-right py-2 pr-4 font-semibold uppercase tracking-wider w-24">Coefficient</th>
            <th scope="col" className="text-left py-2 pr-4 font-semibold uppercase tracking-wider">Evidence Strength</th>
            <th scope="col" className="text-left py-2 font-semibold uppercase tracking-wider hidden md:table-cell">Key Source</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((key) => {
            const ex = FACTOR_EXPLANATIONS[key]
            if (!ex) return null
            const coeff = ex.coefficient
            const isPositive = coeff > 0.001
            const isNegative = coeff < -0.001
            const coeffStr = isPositive ? `+${coeff.toFixed(3)}` : coeff.toFixed(3)

            return (
              <tr key={key} className="border-b border-border/40 hover:bg-background-elevated/20 transition-colors group">
                <td className="py-2 pr-4">
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-left font-medium text-text-primary hover:text-accent transition-colors underline decoration-dotted underline-offset-2"
                      >
                        {ex.title}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs p-3 space-y-1.5">
                      <p className="font-semibold text-xs">{ex.title}</p>
                      <p className="text-xs text-text-secondary leading-relaxed">{ex.mechanism}</p>
                      {ex.rubli_note && (
                        <p className="text-xs text-accent">{ex.rubli_note}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  <span className="block text-text-muted font-mono text-[12px] mt-0.5">{key}</span>
                </td>
                <td className="py-2 pr-4 text-right">
                  <span className={cn(
                    'font-mono font-bold tabular-nums',
                    isPositive && 'text-risk-critical',
                    isNegative && 'text-risk-low',
                    !isPositive && !isNegative && 'text-text-muted',
                  )}>
                    {coeffStr}
                  </span>
                </td>
                <td className="py-2 pr-4 text-text-secondary">
                  {getEvidenceStrength(key)}
                </td>
                <td className="py-2 text-text-muted hidden md:table-cell">{ex.citation}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
        <span className="flex items-center gap-1"><TrendingUp size={11} className="text-risk-critical" /> Increases risk</span>
        <span className="flex items-center gap-1"><TrendingDown size={11} className="text-risk-low" /> Decreases risk (protective)</span>
        <span className="flex items-center gap-1"><Minus size={11} /> Negligible / regularized to zero</span>
        <span className="flex items-center gap-1"><FlaskConical size={11} /> Coefficients from v0.8.5 ElasticNet model (C=0.2243, l1_ratio=0.7545)</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEvidenceStrength(factor: string): string {
  const map: Record<string, string> = {
    vendor_concentration: 'Strong (multiple countries)',
    price_volatility: 'Strong (v0.8.5 top predictor)',
    institution_diversity: 'Negative coefficient on a concentration index — see note',
    win_rate: 'Strong — abnormal rates = market capture',
    sector_spread: 'Negative — protective factor',
    industry_mismatch: 'Moderate',
    same_day_count: 'Moderate — threshold splitting',
    direct_award: 'Moderate — context-dependent',
    ad_period_days: 'Negative in Mexico data',
    network_member_count: 'Moderate',
    year_end: 'Weak — CI crosses zero',
    institution_risk: 'Weak',
    single_bid: 'Strong globally, weak in Mexico',
    price_ratio: 'Near-zero — absorbed by volatility',
    co_bid_rate: 'No signal in training data',
    price_hyp_confidence: 'Near-zero',
  }
  return map[factor] ?? '—'
}
