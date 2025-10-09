# Liftoff Docs Site

Private documentation website for the Liftoff team, built with Next.js and protected by Supabase Auth.

## Features

- **Authentication**: Email/password or magic link login via Supabase
- **Email Whitelist**: Only authorized team members can access
- **Auto-sync**: Content sourced from `../docs/` at build time
- **Private Exclusion**: `docs/private/**` is automatically excluded
- **Search**: Full-text search (coming soon)
- **Responsive**: Mobile-friendly design

## Setup

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 2. Configure Environment Variables

Copy `ENV_TEMPLATE` to `.env.local` and fill in your Supabase credentials:

```bash
cp ENV_TEMPLATE .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (server-side only)
- `ALLOWED_EMAILS`: Comma-separated list of authorized emails
- `ALLOWED_DOMAIN`: Or allow entire domain (e.g., `liftoff.com`)

Optional:
- `BASIC_AUTH_USER` / `BASIC_AUTH_PASS`: Fallback basic auth if Supabase not ready

### 3. Set Up Supabase Auth

In your Supabase project:
1. Go to Authentication > Providers
2. Enable Email provider
3. (Optional) Enable magic links
4. Add your site URL to allowed redirect URLs

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

### Vercel (Recommended)

1. Push this code to your Git repository
2. Import to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

Build settings:
- **Root Directory**: `docs-site`
- **Build Command**: `npm run build` (or `pnpm build`)
- **Output Directory**: `.next`

### Environment Variables in Vercel

Add all variables from `ENV_TEMPLATE` in:
Settings → Environment Variables

## Content Management

- All content is sourced from `../docs/**/*.md`
- `docs/private/**` is automatically excluded for security
- Markdown files support frontmatter for metadata
- Content is indexed at build time

### Adding New Docs

1. Add `.md` files to `../docs/` directories
2. (Optional) Add frontmatter:
   ```yaml
   ---
   title: My Document Title
   ---
   ```
3. Rebuild or redeploy to update

## Security

- All routes except `/login` require authentication
- Email whitelist enforced via middleware
- Private docs (`docs/private/**`) excluded at content loader level
- Session managed via Supabase with secure cookies
- `robots: noindex, nofollow` to prevent indexing

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run linter
```

## Architecture

- **Framework**: Next.js 14 (App Router)
- **Auth**: Supabase Auth with SSR
- **Styling**: Tailwind CSS + Typography plugin
- **Markdown**: next-mdx-remote with rehype plugins
- **Hosting**: Vercel

## Support

For issues or questions, contact the Liftoff ops team.

