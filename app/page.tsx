import { createClient } from '@/lib/supabase/server'
import type { Story } from '@/lib/types'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import StoryCard from '@/components/StoryCard'
import EmailCapture from '@/components/EmailCapture'

export const revalidate = 300

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

interface SectionProps {
  title: string
  subtitle: string
  stories: Story[]
  accentClass: string
}

function Section({ title, subtitle, stories, accentClass }: SectionProps) {
  if (stories.length === 0) return null
  return (
    <section className="mb-12">
      <div className="border-t-2 border-foreground pt-4 mb-1">
        <h2 className={`text-2xl sm:text-3xl font-black tracking-tight uppercase ${accentClass}`}>
          {title}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <div>
        {stories.map((story, i) => (
          <StoryCard key={story.id} story={story} rank={i + 1} />
        ))}
      </div>
    </section>
  )
}

export default async function HomePage() {
  const supabase = await createClient()

  const { data: stories } = await supabase
    .from('stories')
    .select('*')
    .eq('published', true)
    .order('display_order', { ascending: true })
    .order('view_count', { ascending: false })
    .limit(60)

  const all = (stories as Story[]) ?? []

  const good = all.filter(s => s.category === 'good')
  const bad  = all.filter(s => s.category === 'bad')
  const ugly = all.filter(s => s.category === 'ugly')
  const uncategorized = all.filter(s => !s.category)

  const totalCount = all.length
  const msmBlackoutCount = all.filter(s => s.msm_gap).length

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Masthead */}
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3">
            {formatDate(new Date())}
          </p>
          <div className="border-t-2 border-foreground pb-4">
            <h1 className="editorial-title pt-4">
              Today&apos;s Top Clips
            </h1>
            <p className="editorial-body mt-2 max-w-2xl">
              The stories social media can&apos;t stop sharing — ranked by real cross-platform
              engagement. Stories marked{' '}
              <span className="font-semibold text-[oklch(0.45_0.22_24)]">MSM BLACKOUT</span>{' '}
              have not appeared in any major mainstream outlet.
            </p>
          </div>
        </div>

        {/* Stats bar */}
        {totalCount > 0 && (
          <div className="flex items-center gap-6 text-xs text-muted-foreground mb-8 pb-4 border-b border-border">
            <span>
              <strong className="text-foreground tabular-nums">{totalCount}</strong>{' '}
              stories today
            </span>
            {msmBlackoutCount > 0 && (
              <span>
                <strong className="text-[oklch(0.45_0.22_24)] tabular-nums">{msmBlackoutCount}</strong>{' '}
                MSM blackouts
              </span>
            )}
          </div>
        )}

        {totalCount === 0 ? (
          <div className="py-20 text-center">
            <p className="text-muted-foreground">Stories are being curated. Check back soon.</p>
          </div>
        ) : (
          <>
            <Section
              title="The Good"
              subtitle="Heroes, rescues, and breakthroughs in energy, food, water, and planet"
              stories={good}
              accentClass="text-[oklch(0.38_0.13_145)]"
            />
            <Section
              title="The Bad"
              subtitle="Crime, corruption, and misconduct the public deserves to know about"
              stories={bad}
              accentClass="text-foreground"
            />
            <Section
              title="The Ugly"
              subtitle="What the media won't show you — significant stories with zero mainstream coverage"
              stories={ugly}
              accentClass="text-[oklch(0.45_0.22_24)]"
            />
            {uncategorized.length > 0 && (
              <Section
                title="Latest"
                subtitle="Recently added"
                stories={uncategorized}
                accentClass="text-muted-foreground"
              />
            )}
          </>
        )}

        <EmailCapture />

      </main>
      <Footer />
    </>
  )
}
