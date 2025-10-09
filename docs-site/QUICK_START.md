# Quick Start Guide

## Option 1: Use Existing Supabase Project

You already have Supabase configured in the frontend. Reuse those credentials:

1. Copy `.env` from frontend to docs-site:
   ```bash
   cd docs-site
   echo "NEXT_PUBLIC_SUPABASE_URL=$REACT_APP_SUPABASE_URL" > .env.local
   echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$REACT_APP_SUPABASE_ANON_KEY" >> .env.local
   echo "ALLOWED_EMAILS=eric@liftoff.com" >> .env.local
   ```

2. Install and run:
   ```bash
   npm install
   npm run dev
   ```

3. Open http://localhost:3000

## Option 2: Quick Test with Basic Auth

Skip Supabase temporarily and use Basic Auth:

1. Create `.env.local`:
   ```bash
   cd docs-site
   cat > .env.local << 'EOF'
   BASIC_AUTH_USER=admin
   BASIC_AUTH_PASS=liftoff2025
   NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder
   EOF
   ```

2. Install and run:
   ```bash
   npm install
   npm run dev
   ```

3. Open http://localhost:3000
4. When prompted, enter:
   - Username: `admin`
   - Password: `liftoff2025`

## Next Steps

- Add more authorized emails to `ALLOWED_EMAILS`
- Deploy to Vercel (see DEPLOYMENT.md)
- Set up proper Supabase Auth for production
- Invite team members

