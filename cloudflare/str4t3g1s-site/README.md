# str4t3g1s Site

Cloudflare Pages site for the Meta policy harness.

Routes:

- `/` static overview and smoke-test UI
- `/api/health` worker health check
- `/api/meta-policy/*` bearer-protected edge-native harness routes

Deploy:

```bash
cd cloudflare/str4t3g1s-site
npx wrangler pages project create str4t3g1s-site --production-branch main
npx wrangler pages secret put PARTNER_API_KEY --project-name str4t3g1s-site
npx wrangler pages deploy . --project-name str4t3g1s-site
```

Then attach the custom domain `str4t3g1s.com` to the Pages project.
