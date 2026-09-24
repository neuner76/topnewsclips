import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/server'
import { fetchMarinPermitDetail, permitOpenDataRecordUrl, MARIN_PERMIT_LOOKUP_URL, type PermitDetail } from '@/lib/local/adapters/marin-permits'
import { CopyChip } from './CopyChip'

// Owner-gated, dynamic — mirrors /local. Renders one permit's public record,
// fetched live from the county open-data API (Marin has no linkable per-permit
// page of its own).
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Permit — My Local' }

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-[780px] px-4 py-8 sm:px-6 text-foreground">{children}</main>
      <Footer />
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="border-t border-[#EFF2F6] py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm text-foreground">{value}</div>
    </div>
  )
}

export default async function PermitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { id } = await params

  let permit: PermitDetail | null
  try {
    permit = await fetchMarinPermitDetail(id)
  } catch {
    return (
      <Shell>
        <Link href="/local" className="text-sm text-[#2563EB] hover:underline">← Back to My Local</Link>
        <p className="mt-4 text-sm text-red-600">Couldn’t load this permit right now.</p>
      </Shell>
    )
  }

  if (!permit) {
    return (
      <Shell>
        <Link href="/local" className="text-sm text-[#2563EB] hover:underline">← Back to My Local</Link>
        <p className="mt-4 text-sm text-muted-foreground">No permit found for this reference.</p>
      </Shell>
    )
  }

  const mapUrl =
    permit.lat != null && permit.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${permit.lat},${permit.lng}`
      : permit.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(permit.address)}`
        : undefined

  return (
    <Shell>
      <Link href="/local" className="text-sm text-[#2563EB] hover:underline">← Back to My Local</Link>

      <header className="mb-4 mt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2563EB]">🏗️ Building Permit</p>
        <h1 className="mt-1.5 text-2xl font-black leading-tight tracking-tight text-foreground sm:text-3xl">{permit.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {permit.valuationUsd != null && (
            <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-sm font-semibold tabular-nums text-[#0F172A]">
              ${permit.valuationUsd.toLocaleString()}
            </span>
          )}
          {permit.address && <span className="text-sm text-muted-foreground">{permit.address}</span>}
        </div>
      </header>

      <section className="rounded-2xl border border-[#D8E0EA] bg-white px-4 pb-2 pt-1 sm:px-5">
        <Field label="Permit number" value={permit.permitNumber} />
        <Field label="Date issued / received" value={permit.dateLabel} />
        <Field label="Type" value={permit.type} />
        <Field label="Category" value={permit.category} />
        <Field label="Work class" value={permit.workClass} />
        <Field label="Description" value={permit.description} />
        {permit.parcelNumber && (
          <div className="border-t border-[#EFF2F6] py-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Parcel (APN)</div>
            <div className="mt-0.5"><CopyChip value={permit.parcelNumber} label="parcel number" /></div>
          </div>
        )}
        <Field label="Contractor address" value={permit.contractorAddress} />
      </section>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        {mapUrl && (
          <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[#2563EB] hover:underline">
            View on map →
          </a>
        )}
        <a href={MARIN_PERMIT_LOOKUP_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-[#2563EB] hover:underline">
          Look up official records for this parcel →
        </a>
        <a href={permitOpenDataRecordUrl(permit.uniqueId)} target="_blank" rel="noopener noreferrer" className="font-medium text-[#2563EB] hover:underline">
          County open-data record →
        </a>
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
        Source: Marin County Building Permits (open data), unincorporated areas. Updated daily. The county’s
        permit report can’t link to a single permit — click above, then paste the copied parcel number (APN)
        into its search to see every permit on this parcel.
      </p>
    </Shell>
  )
}
