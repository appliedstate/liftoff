import { getDocBySlug, getAllDocs } from '@/lib/content'
import Markdown from '@/components/Markdown'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{
    slug: string[]
  }>
}

export async function generateStaticParams() {
  const docs = await getAllDocs()
  return docs.map((doc) => ({
    slug: doc.slug.split('/'),
  }))
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params
  const slugString = slug.join('/')
  
  const doc = await getDocBySlug(slugString)

  if (!doc) {
    notFound()
  }

  return (
    <article className="space-y-6">
      <header>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          {doc.meta.title}
        </h1>
        <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
          <p>{doc.meta.path}</p>
          {doc.frontmatter && (
            <div className="flex flex-wrap gap-3">
              {doc.frontmatter.owners && (
                <span>Owners: {Array.isArray(doc.frontmatter.owners) ? doc.frontmatter.owners.join(', ') : String(doc.frontmatter.owners)}</span>
              )}
              {doc.frontmatter.status && (
                <span>Status: {String(doc.frontmatter.status)}</span>
              )}
              {doc.frontmatter.last_reviewed && (
                <span>Last reviewed: {String(doc.frontmatter.last_reviewed)}</span>
              )}
              {doc.frontmatter.approved_by && (
                <span>Approved by: {String(doc.frontmatter.approved_by)}</span>
              )}
            </div>
          )}
        </div>
      </header>
      <Markdown content={doc.content} />
    </article>
  )
}


