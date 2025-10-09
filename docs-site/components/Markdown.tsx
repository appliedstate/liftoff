import { MDXRemote } from 'next-mdx-remote/rsc'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'

interface MarkdownProps {
  content: string
}

export default async function Markdown({ content }: MarkdownProps) {
  return (
    <div className="markdown prose prose-slate dark:prose-invert max-w-none">
      <MDXRemote
        source={content}
        options={{
          mdxOptions: {
            rehypePlugins: [
              rehypeHighlight,
              rehypeSlug,
              [rehypeAutolinkHeadings, { behavior: 'wrap' }],
            ],
          },
        }}
      />
    </div>
  )
}

