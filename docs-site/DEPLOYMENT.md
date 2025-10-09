# Deployment Guide

## Vercel Deployment (Recommended)

### Step 1: Prepare Repository

```bash
cd /Users/ericroach/Desktop/Desktop\ -\ Eric\'s\ MacBook\ Air/Liftoff
git add docs-site/
git commit -m "feat: Add private docs site with Supabase Auth"
git push origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your Liftoff repository
4. Configure project:
   - **Root Directory**: `docs-site`
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)

### Step 3: Set Environment Variables

In Vercel project settings → Environment Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
ALLOWED_EMAILS=eric@liftoff.com,ben@liftoff.com
ALLOWED_DOMAIN=liftoff.com
```

Optional fallback:
```
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=<generate-secure-password>
```

### Step 4: Get Supabase Credentials

1. Go to your Supabase project dashboard
2. Settings → API
3. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

### Step 5: Configure Supabase Auth

1. Go to Authentication → URL Configuration
2. Add Site URL: `https://your-vercel-domain.vercel.app`
3. Add Redirect URLs:
   - `https://your-vercel-domain.vercel.app/**`
   - `https://your-custom-domain.com/**` (if using custom domain)

### Step 6: Deploy

Click "Deploy" in Vercel. Your site will be live in ~2 minutes.

## Post-Deployment

### Test Authentication

1. Visit your deployed URL
2. Should redirect to `/login`
3. Try logging in with an authorized email
4. If using magic link, check email for login link
5. After login, you should see the docs homepage

### Add Team Members

To grant access to new team members:

1. Update `ALLOWED_EMAILS` in Vercel env vars
2. Or have them use an email matching `ALLOWED_DOMAIN`
3. They need to sign up via the login page
4. Redeploy or wait for next build

### Custom Domain (Optional)

1. In Vercel project → Settings → Domains
2. Add your custom domain (e.g., `docs.liftoff.com`)
3. Follow DNS configuration instructions
4. Update Supabase redirect URLs to include custom domain

## Troubleshooting

### "Authentication required" on every page
- Check that Supabase env vars are set correctly
- Verify middleware.ts is not blocking all routes
- Check browser console for errors

### "Email not authorized"
- Verify user's email is in `ALLOWED_EMAILS`
- Or check if email domain matches `ALLOWED_DOMAIN`
- Check middleware.ts whitelist logic

### Build fails
- Ensure `docs-site/` has all files committed
- Check build logs in Vercel for specific errors
- Verify all dependencies in package.json

### Private docs visible
- Verify content.ts filters `**/private/**` correctly
- Check glob patterns in getAllDocs()
- Test locally: search output for "private" or "comp"

## Auto-Deploy on Push

Vercel automatically deploys on every push to `main`:
1. Push to `main` branch
2. Vercel detects changes
3. Builds and deploys automatically
4. View deployment in Vercel dashboard

## Rollback

If needed, rollback to previous deployment:
1. Go to Vercel project → Deployments
2. Find previous successful deployment
3. Click "..." → "Promote to Production"

