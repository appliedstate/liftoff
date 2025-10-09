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
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {doc.meta.path}
        </p>
      </header>
      <Markdown content={doc.content} />
    </article>
  )
}

