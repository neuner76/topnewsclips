import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Story } from '@/lib/types'
import StoryForm from '@/components/admin/StoryForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditStoryPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase.from('stories').select('*').eq('id', id).single()
  if (!data) notFound()

  return (
    <div>
      <h1 className="text-lg font-bold mb-6">Edit Story</h1>
      <StoryForm story={data as Story} />
    </div>
  )
}
