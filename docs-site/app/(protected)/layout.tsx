import { createClient } from '@/lib/supabase-server'
import { getNavigation } from '@/lib/content'
import Header from '@/components/Header'
import Nav from '@/components/Nav'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const navigation = await getNavigation()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header user={user || undefined} />
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          <aside className="w-64 flex-shrink-0">
            <div className="sticky top-24">
              <Nav items={navigation} />
            </div>
          </aside>
          <main className="flex-1 min-w-0">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

