import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import QuestionReviewForm from './QuestionReviewForm'

export const revalidate = 0

interface QuestionRow {
  id: string
  story_id: string | null
  story_slug: string | null
  question: string
  email: string | null
  status: string
  moderation_notes: string | null
  created_at: string
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-700 bg-amber-50 dark:bg-amber-950/20',
  approved: 'text-green-700 bg-green-50 dark:bg-green-950/20',
  rejected: 'text-blue-700 bg-blue-50 dark:bg-blue-950/20',
  answered: 'text-purple-700 bg-purple-50 dark:bg-purple-950/20',
  archived: 'text-muted-foreground bg-muted',
}

export default async function ReaderQuestionsPage() {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('reader_questions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const questions = (data ?? []) as QuestionRow[]
  const pending = questions.filter(q => q.status === 'pending')
  const reviewed = questions.filter(q => q.status !== 'pending')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Reader Questions</h1>
        <p className="text-xs text-muted-foreground">Private until moderated.</p>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-8">
        {['pending', 'approved', 'rejected', 'answered', 'archived'].map(status => (
          <div key={status} className="bg-card rounded border border-border p-4">
            <p className="text-2xl font-bold tabular-nums">{questions.filter(q => q.status === status).length}</p>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{status}</p>
          </div>
        ))}
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-semibold mb-3">Pending Review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">No pending reader questions.</p>
        ) : (
          <div className="bg-card rounded border border-border divide-y divide-border">
            {pending.map(question => (
              <div key={question.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm font-semibold">{question.question}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Submitted {formatDate(question.created_at)}
                      {question.email && ` · ${question.email}`}
                      {question.story_slug && (
                        <> · <Link href={`/story/${question.story_slug}`} target="_blank" className="hover:underline">story</Link></>
                      )}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_COLORS[question.status]}`}>
                    {question.status}
                  </span>
                </div>
                <QuestionReviewForm questionId={question.id} currentStatus={question.status} currentNotes={question.moderation_notes} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3">Reviewed ({reviewed.length})</h2>
        <div className="bg-card rounded border border-border divide-y divide-border">
          {reviewed.map(question => (
            <div key={question.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold">{question.question}</p>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_COLORS[question.status]}`}>
                  {question.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(question.created_at)}
                {question.story_slug && (
                  <> · <Link href={`/story/${question.story_slug}`} target="_blank" className="hover:underline">story</Link></>
                )}
              </p>
              {question.moderation_notes && <p className="text-xs text-muted-foreground mt-1 italic">{question.moderation_notes}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
