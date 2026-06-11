import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PreferenceOnboarding from '@/components/PreferenceOnboarding'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Customize Your Briefing | Top News Clips',
  description: 'Choose what you want more of in your Top News Clips briefing.',
  robots: { index: false },
}

export default async function PreferencesPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-white">
        <div className="mb-8 border-b-2 border-[oklch(0.52_0.14_196)] pb-6">
          <p className="text-[10px] font-bold tracking-widest text-white/45 uppercase mb-2">
            Top News Clips
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3 text-white">
            Customize your briefing
          </h1>
          <p className="text-base text-white/70 leading-relaxed">
            Choose what you want more of. Your top stories stay editorial. We never narrow the news, we add to it.
          </p>
        </div>

        <PreferenceOnboarding token={token} />
      </main>
      <Footer />
    </>
  )
}
