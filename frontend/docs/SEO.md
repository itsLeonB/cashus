# SEO & Site Visibility

This document describes how site visibility is handled in Cashus and what
remains to be done. It backs GitHub issue #68 (Site Visibility Enhancements).

## Overview

Cashus is a client-rendered React SPA on Vercel. Because there is no
server rendering, non-JS crawlers and social scrapers see only the static
`index.html` shell. Our approach is therefore two-layered:

1. **Static baseline in `index.html`** — a complete set of meta tags, Open
   Graph / Twitter cards, and site-wide JSON-LD. This is what social
   scrapers (Facebook, LinkedIn, Slack, X) and non-JS crawlers see for the
   root URL, with no JavaScript required.
2. **Per-route metadata via `src/components/Seo.tsx`** — uses React 19's
   native hoisting of `<title>`/`<meta>`/`<link>` into `<head>`. JS-rendering
   crawlers (Googlebot) pick these up so each route gets a unique title,
   description, canonical URL, and social card; non-JS scrapers never run this
   code, so they still see the static baseline unless the route is prerendered.

The app is rendered client-side only (`createRoot`, no hydration), so React
never reconciles against the static tags already in `index.html`. Those
tags are marked with `data-default-seo` and removed by `<Seo>` on mount, so
JS-rendering crawlers see exactly one (correct) `title`/`description`/
`robots`/`canonical`/OG/Twitter tag per route instead of the static default
and the per-route value both being present.

## What's implemented

### Traditional SEO
- Per-route `<Seo>` on public pages (`/`, `/privacy-policy`,
  `/terms-of-service`) with unique title/description + canonical URL.
- `noindex` on the authenticated app (`AppLayout`), auth pages
  (`AuthLayout`), the standalone `/onboarding` and `/auth/reset-password`
  routes, shared-profile pages (`/f/:slug`) and 404.
- Full OG + `summary_large_image` Twitter cards.
- Site-wide JSON-LD (`Organization`, `WebSite`, `SoftwareApplication`) in
  `index.html`.
- `public/sitemap.xml` listing the public routes, referenced from
  `robots.txt`.
- `public/robots.txt` allows the marketing surface and disallows the app
  and shared-profile routes.

### AI SEO
- `public/llms.txt` — a concise, crawlable summary of Cashus for LLM
  ingestion.
- `robots.txt` explicitly welcomes AI crawlers (GPTBot, OAI-SearchBot,
  ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended) on the public
  surface while keeping them out of the app.

### Configuration
- The production origin is `https://cashus.online`.
- `config.SITE_URL` (env `VITE_SITE_URL`, default `https://cashus.online`)
  is the canonical origin used by the `<Seo>` component.
- `index.html` uses a `%VITE_SITE_URL%` placeholder for its canonical, OG,
  Twitter, and JSON-LD URLs. The `inject-site-url` Vite plugin
  (`vite.config.ts`) replaces it at build time with `VITE_SITE_URL`, falling
  back to `https://cashus.online` when the env var is unset — so staging and
  preview builds never advertise the wrong origin. Set `VITE_SITE_URL` in
  Vercel to the deployed origin so previews use their own URL.
- Static URLs in `sitemap.xml`, `robots.txt`, and `llms.txt` live in
  `public/` (served verbatim, not build-substituted) and are hardcoded to
  `https://cashus.online`. **When the canonical marketing domain changes (see
  domain split below), these must be updated.**

## Follow-up: domain split (www marketing / app)

The issue also calls for splitting the marketing site and the app onto
separate subdomains:

- `www.cashus.online` → marketing surface (landing, privacy, terms) —
  indexable, canonical.
- `app.cashus.online` → the authenticated app — `noindex`, redirect root to
  `/login` (or `/dashboard`).

Recommended approach: **one Vercel project serving both subdomains** (least
infra, single codebase). Required work when it's scheduled:

1. **DNS / Vercel** (dashboard, outside this repo): add `www` and `app` as
   domains on the Vercel project; point DNS accordingly. Decide the apex
   (`cashus.online`) behavior — redirect apex → `www`.
2. **Canonical origin**: set `VITE_SITE_URL=https://www.cashus.online` and
   update the hardcoded `https://cashus.online` origins in `sitemap.xml`,
   `robots.txt`, and `llms.txt` to `www`.
3. **Host-aware routing** in `vercel.json`: on `app.cashus.online`, redirect
   marketing paths to `www`; on `www.cashus.online`, redirect app paths to
   `app`. Serve a host-specific `robots.txt` (or a `noindex` header for the
   whole `app.` host).
4. **`app.` host**: add `X-Robots-Tag: noindex` response header so the
   entire app subdomain stays out of search indexes regardless of route.

## Follow-up: prerendering (optional, higher impact)

Googlebot renders JS, so it already sees the per-route `<Seo>` tags. The
remaining gap is non-JS consumers of *non-root* routes. If richer coverage
is needed, prerender the handful of public routes at build time
(`react-snap` or a Vite prerender plugin) to emit static HTML per route.
Deferred for now to avoid adding heavy build-time dependencies (Puppeteer)
that could affect the Vercel build.
