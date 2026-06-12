'use client'

import Link from 'next/link'
import { track } from '@/lib/analytics'

export default function ResponseActionLink({ href, children, storySlug, storyCategory, eligibility, responseType }: {
  href: string
  children: React.ReactNode
  storySlug: string
  storyCategory: string
  eligibility: string
  responseType: string
}) {
  const isExternal = href.startsWith('http')
  const className = 'text-sm font-semibold text-white/80 hover:text-white hover:underline underline-offset-2'
  const onClick = () => track('response_resource_click', {
    story_slug: storySlug,
    story_category: storyCategory,
    response_eligibility: eligibility,
    response_type: responseType,
    surface: 'story_page',
  })

  if (isExternal) {
    return <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>{children}</a>
  }

  return <Link href={href} onClick={onClick} className={className}>{children}</Link>
}
