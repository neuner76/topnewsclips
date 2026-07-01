// Production lead enforcement — wires the (previously dormant) lead-eligibility
// gate into the live digest path.
//
// The generator lets the model order Need To Know; needToKnow[0] becomes the
// lead. Nothing downstream checked that the lead is actually reported,
// corroborated, and consequential — so a single-source, consequence-thin item
// (e.g. a celebrity injury on the wire) could anchor the whole edition. This
// applies evaluateLeadEligibility to the chosen lead and, when it fails,
// promotes the strongest eligible Need To Know item instead. If nothing is
// eligible, it keeps the lead but surfaces a degraded notice so the edition is
// never silently anchored by a weak lead.

import { evaluateLeadEligibility, type LeadCandidate, type LeadEditorialOverride } from './lead-eligibility'
import type { SourcePolicy } from './source-policy'

export const DEGRADED_LEAD_MESSAGE =
  'Lead chosen under degraded eligibility — no fully eligible story today.'

export interface LeadDegradedNotice {
  message: string
  failedGates: string[]
}

export interface LeadEnforcementResult<T> {
  needToKnow: T[]
  // Set only when nothing was eligible and the weak lead was kept.
  notice?: LeadDegradedNotice
  // Set to the promoted slug when a stronger item was moved into the lead slot.
  reorderedTo?: string
}

export interface LeadEnforcementOptions {
  policyForSlug?: (slug: string) => SourcePolicy | undefined
  overrideForSlug?: (slug: string) => LeadEditorialOverride | undefined
}

export function enforceLeadEligibility<T extends { slug: string }>(
  needToKnow: T[],
  storyForSlug: (slug: string) => LeadCandidate | undefined,
  opts: LeadEnforcementOptions = {}
): LeadEnforcementResult<T> {
  if (needToKnow.length === 0) return { needToKnow }

  const gateOf = (slug: string) => {
    const story = storyForSlug(slug)
    if (!story) return undefined
    return evaluateLeadEligibility(story, {
      policy: opts.policyForSlug?.(slug),
      override: opts.overrideForSlug?.(slug),
    })
  }

  const leadGate = gateOf(needToKnow[0].slug)
  // Eligible — or unresolved (missing data is not treated as a failure) — leaves
  // the model's ordering intact.
  if (!leadGate || leadGate.status === 'eligible') return { needToKnow }

  // Lead failed the gate. Promote the strongest (earliest) eligible item.
  const promoteIdx = needToKnow.findIndex((item, i) => i > 0 && gateOf(item.slug)?.status === 'eligible')
  if (promoteIdx !== -1) {
    const reordered = [...needToKnow]
    const [promoted] = reordered.splice(promoteIdx, 1)
    reordered.unshift(promoted)
    return { needToKnow: reordered, reorderedTo: promoted.slug }
  }

  // Nothing eligible: keep the lead but surface why it was seated under duress.
  return {
    needToKnow,
    notice: { message: DEGRADED_LEAD_MESSAGE, failedGates: leadGate.reasons },
  }
}
