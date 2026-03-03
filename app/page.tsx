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
  pinned: Story[]
  voices: Story[]
  stories: Story[]
  accentClass: string
}

function SubHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mt-5 mb-1">
      {label}
    </p>
  )
}

function Section({ title, subtitle, pinned, voices, stories, accentClass }: SectionProps) {
  const isEmpty = pinned.length === 0 && voices.length === 0 && stories.length === 0
  let rank = 1
  return (
    <section className="mb-12">
      <div className="border-t-2 border-foreground pt-4 mb-1">
        <h2 className={`text-2xl sm:text-3xl font-black tracking-tight uppercase ${accentClass}`}>
          {title}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {isEmpty ? (
        <p className="text-sm text-muted-foreground py-6">Stories being curated — check back soon.</p>
      ) : (
        <div>
          {pinned.length > 0 && (
            <>
              <SubHeader label="Featured" />
              {pinned.map(story => (
                <StoryCard key={story.id} story={story} rank={rank++} />
              ))}
            </>
          )}
          {voices.length > 0 && (
            <>
              <SubHeader label="Independent Voices" />
              {voices.map(story => (
                <StoryCard key={story.id} story={story} rank={rank++} />
              ))}
            </>
          )}
          {stories.length > 0 && (
            <>
              <SubHeader label="Trending" />
              {stories.map(story => (
                <StoryCard key={story.id} story={story} rank={rank++} />
              ))}
            </>
          )}
        </div>
      )}
    </section>
  )
}

export default async function HomePage() {
  const supabase = await createClient()

  const { data: stories } = await supabase
    .from('stories')
    .select('*')
    .eq('published', true)
    .order('pinned', { ascending: false })
    .order('display_order', { ascending: true })
    .order('view_count', { ascending: false })
    .limit(60)

  const all = (stories as Story[]) ?? []

  function splitSection(category: 'good' | 'bad' | 'ugly') {
    const section = all.filter(s => s.category === category)
    return {
      pinned:  section.filter(s => s.pinned),
      voices:  section.filter(s => !s.pinned && !!s.journalist_username),
      stories: section.filter(s => !s.pinned && !s.journalist_username),
    }
  }

  const good = splitSection('good')
  const bad  = splitSection('bad')
  const ugly = splitSection('ugly')
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
              Independent journalists. Real stories. No corporate filter.{' '}
              Stories marked{' '}
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

        <Section
          title="The Good"
          subtitle="Heroes, rescues, and breakthroughs in energy, food, water, and planet"
          pinned={good.pinned}
          voices={good.voices}
          stories={good.stories}
          accentClass="text-[oklch(0.38_0.13_145)]"
        />
        <Section
          title="The Bad"
          subtitle="Government corruption, misconduct, and institutional failures the public deserves to know about"
          pinned={bad.pinned}
          voices={bad.voices}
          stories={bad.stories}
          accentClass="text-foreground"
        />
        <Section
          title="The Ugly"
          subtitle="What the media won't show you — significant stories with zero mainstream coverage"
          pinned={ugly.pinned}
          voices={ugly.voices}
          stories={ugly.stories}
          accentClass="text-[oklch(0.45_0.22_24)]"
        />
        {uncategorized.length > 0 && (
          <Section
            title="Latest"
            subtitle="Recently added"
            pinned={[]}
            voices={[]}
            stories={uncategorized}
            accentClass="text-muted-foreground"
          />
        )}

        <EmailCapture />

      </main>
      <Footer />
    </>
  )
}
