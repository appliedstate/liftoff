import Link from 'next/link'
import { NavItem } from '@/lib/content'

interface NavProps {
  items: NavItem[]
  currentSlug?: string
}

function NavItemComponent({ item, currentSlug, depth = 0 }: { item: NavItem; currentSlug?: string; depth?: number }) {
  const isActive = item.slug === currentSlug
  const hasChildren = item.children && item.children.length > 0

  return (
    <li className={`${depth > 0 ? 'ml-4' : ''}`}>
      {item.slug ? (
        <Link
          href={`/docs/${item.slug}`}
          className={`block py-1.5 px-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
            isActive ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {item.title}
        </Link>
      ) : (
        <div className={`py-1.5 px-2 text-sm font-semibold text-gray-900 dark:text-white ${depth === 0 ? 'mt-4' : 'mt-2'}`}>
          {item.title}
        </div>
      )}
      {hasChildren && (
        <ul className="space-y-1">
          {item.children!.map((child, index) => (
            <NavItemComponent key={index} item={child} currentSlug={currentSlug} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function Nav({ items, currentSlug }: NavProps) {
  return (
    <nav className="space-y-1">
      <ul>
        {items.map((item, index) => (
          <NavItemComponent key={index} item={item} currentSlug={currentSlug} />
        ))}
      </ul>
    </nav>
  )
}

