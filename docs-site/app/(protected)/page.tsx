import { getAllDocs } from '@/lib/content'
import Link from 'next/link'

export default async function HomePage() {
  const docs = await getAllDocs()

  // Group by category
  const byCategory: Record<string, typeof docs> = {}
  docs.forEach((doc) => {
    if (!byCategory[doc.category]) {
      byCategory[doc.category] = []
    }
    byCategory[doc.category].push(doc)
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to Liftoff Docs
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Internal documentation and operational guides for the Liftoff team.
        </p>
      </div>

      <div className="space-y-8">
        {Object.entries(byCategory)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, categoryDocs]) => (
            <div key={category}>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 capitalize">
                {category.replace(/[-_]/g, ' ')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryDocs.map((doc) => (
                  <Link
                    key={doc.slug}
                    href={`/docs/${doc.slug}`}
                    className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                      {doc.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {doc.path}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

