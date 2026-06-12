import type { Story } from '@/lib/types'
import type { ResponseResource } from '@/lib/response-types'
import { getResponseEligibility } from '@/lib/response-eligibility'
import SectionCard from './SectionCard'
import ReaderQuestionBox from './ReaderQuestionBox'
import ResponseActionLink from './ResponseActionLink'
import TrackEvent from './TrackEvent'

function sourceUrl(story: Story): string | null {
  if (story.platform === 'youtube') return story.embed_url
  return story.embed_url || null
}

export default function StayWithThisStory({ story, resources = [] }: {
  story: Story
  resources?: ResponseResource[]
}) {
  const eligibility = getResponseEligibility(story)
  if (eligibility.eligibility === 'none') return null

  const allowed = new Set(eligibility.allowedTypes)
  const primarySource = sourceUrl(story)

  return (
    <SectionCard accent="#14b8a6" className="mb-4">
      <TrackEvent
        name="response_module_impression"
        properties={{
          story_slug: story.slug,
          story_category: eligibility.storyCategory,
          response_eligibility: eligibility.eligibility,
          source_tier: story.source_tier,
          surface: 'story_page',
        }}
      />
      <div className="mb-4">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#14b8a6] mb-1">Stay with this story</p>
        <p className="text-xs text-white/45">
          Response links are not endorsements. They are restrained ways to learn more, track updates, and ask better questions.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {allowed.has('learn') && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-bold text-white mb-1">Learn</p>
            <p className="text-xs text-white/45 mb-2">Read the primary source or background context before reacting.</p>
            {primarySource ? (
              <ResponseActionLink href={primarySource} storySlug={story.slug} storyCategory={eligibility.storyCategory} eligibility={eligibility.eligibility} responseType="learn">
                Open source material →
              </ResponseActionLink>
            ) : (
              <ResponseActionLink href="/response-taxonomy" storySlug={story.slug} storyCategory={eligibility.storyCategory} eligibility={eligibility.eligibility} responseType="learn">
                How we evaluate response links →
              </ResponseActionLink>
            )}
          </div>
        )}

        {allowed.has('track') && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-bold text-white mb-1">Track</p>
            <p className="text-xs text-white/45 mb-2">Follow updates as this story develops.</p>
            <ResponseActionLink href={`/search?q=${encodeURIComponent(story.title)}`} storySlug={story.slug} storyCategory={eligibility.storyCategory} eligibility={eligibility.eligibility} responseType="track">
              Search related updates →
            </ResponseActionLink>
          </div>
        )}

        {allowed.has('share_responsibly') && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-bold text-white mb-1">Share responsibly</p>
            <p className="text-xs text-white/45">
              Share the story with context, not outrage. Include what is known and what remains unclear.
            </p>
          </div>
        )}

        {resources.map(resource => (
          <div key={resource.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-bold text-white mb-1">{resource.title}</p>
            <p className="text-xs text-white/45 mb-2">{resource.description}</p>
            <ResponseActionLink href={resource.url} storySlug={story.slug} storyCategory={eligibility.storyCategory} eligibility={eligibility.eligibility} responseType={resource.responseType}>
              Open approved resource →
            </ResponseActionLink>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <ReaderQuestionBox
          storySlug={story.slug}
          storyId={story.id}
          storyCategory={eligibility.storyCategory}
          eligibility={eligibility.eligibility}
        />
      </div>

      <p className="mt-3 text-[11px] text-white/30">
        Eligibility: {eligibility.reason}{' '}
        <ResponseActionLink href="/response-taxonomy" storySlug={story.slug} storyCategory={eligibility.storyCategory} eligibility={eligibility.eligibility} responseType="learn">
          View taxonomy →
        </ResponseActionLink>
      </p>
    </SectionCard>
  )
}
