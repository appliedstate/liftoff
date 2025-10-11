'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

interface HeaderProps {
  user?: { email?: string }
}

export default function Header({ user }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Liftoff Docs
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          {user?.email && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {user.email}
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}


