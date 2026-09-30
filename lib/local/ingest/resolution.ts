// The three ways an event ends (§4.2 of the event-history spec). Written to the
// `resolved` local_event_update row's new_value.reason so the history view can word
// the resolution correctly. Shared by both resolvers (absence + §7.4 sweep).
export type ResolutionReason = 'feed_absent' | 'explicit_end' | 'time_sweep'

export interface ResolvedUpdateRow {
  event_id: string
  kind: 'resolved'
  text: string
  new_value: { reason: ResolutionReason }
}

export function resolvedUpdateRow(eventId: string, reason: ResolutionReason, text: string): ResolvedUpdateRow {
  return { event_id: eventId, kind: 'resolved', text, new_value: { reason } }
}
