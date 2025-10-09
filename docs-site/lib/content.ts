import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { glob } from 'glob'

const DOCS_PATH = path.join(process.cwd(), '..', 'docs')

export interface DocMeta {
  title: string
  slug: string
  path: string
  category: string
}

export interface DocContent {
  meta: DocMeta
  content: string
  frontmatter: Record<string, any>
}

export async function getAllDocs(): Promise<DocMeta[]> {
  // Exclude docs/private/** using glob pattern
  const pattern = path.join(DOCS_PATH, '**/*.md')
  const files = await glob(pattern, {
    ignore: [
      '**/node_modules/**',
      '**/private/**',
      '**/.*',
    ],
  })

  const docs: DocMeta[] = files.map((filePath) => {
    const relativePath = path.relative(DOCS_PATH, filePath)
    const slug = relativePath.replace(/\.md$/, '')
    const category = slug.split('/')[0] || 'general'
    
    // Read frontmatter for title
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const { data } = matter(fileContent)
    
    // Use frontmatter title or derive from filename
    const fileName = path.basename(filePath, '.md')
    const title = data.title || fileName.replace(/[-_]/g, ' ')

    return {
      title,
      slug,
      path: relativePath,
      category,
    }
  })

  return docs.sort((a, b) => a.slug.localeCompare(b.slug))
}

export async function getDocBySlug(slug: string): Promise<DocContent | null> {
  try {
    const filePath = path.join(DOCS_PATH, `${slug}.md`)
    
    // Security check: prevent accessing private docs
    if (filePath.includes('/private/')) {
      return null
    }

    if (!fs.existsSync(filePath)) {
      return null
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(fileContent)

    const relativePath = path.relative(DOCS_PATH, filePath)
    const category = slug.split('/')[0] || 'general'
    const fileName = path.basename(filePath, '.md')
    const title = data.title || fileName.replace(/[-_]/g, ' ')

    return {
      meta: {
        title,
        slug,
        path: relativePath,
        category,
      },
      content,
      frontmatter: data,
    }
  } catch (error) {
    console.error('Error loading doc:', error)
    return null
  }
}

export interface NavItem {
  title: string
  slug?: string
  children?: NavItem[]
}

export async function getNavigation(): Promise<NavItem[]> {
  const docs = await getAllDocs()
  
  // Build a tree structure
  const tree: Record<string, NavItem> = {}

  docs.forEach((doc) => {
    const parts = doc.slug.split('/')
    let current = tree

    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = {
          title: part.replace(/[-_]/g, ' ').replace(/^\d+-/, ''),
          children: {},
        }
      }

      if (index === parts.length - 1) {
        // Leaf node - this is a document
        current[part].slug = doc.slug
        current[part].title = doc.title
      } else {
        // Branch node
        current = current[part].children as Record<string, NavItem>
      }
    })
  })

  // Convert to array and clean up
  function treeToArray(obj: Record<string, NavItem>): NavItem[] {
    return Object.values(obj).map((item) => {
      if (item.children && Object.keys(item.children).length > 0) {
        return {
          title: item.title,
          children: treeToArray(item.children as Record<string, NavItem>),
        }
      }
      return {
        title: item.title,
        slug: item.slug,
      }
    })
  }

  return treeToArray(tree)
}

