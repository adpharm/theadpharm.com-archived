# Changelog

## 2026-03-09

- feat: Contact form now submits to a local `/api/contact` endpoint that validates input and delivers email via the `@cdv2/email` service, replacing the old external data-collector integration
- feat: Contact form displays inline success and error states after submission instead of silently resetting
- chore: Removed hardcoded Google Maps Embed API key in favour of a static embed URL on the contact page
- chore: Expanded Taskfile with typecheck, Vercel env pull, and a full Terraform task suite (destroy, import, list, refresh, output, validate, fmt)
