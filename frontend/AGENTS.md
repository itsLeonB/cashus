# AGENTS.md

## Project Overview

Cashus is a modern expense-splitting and debt-tracking web application. This repository (`cashus-redesign`) is the **frontend SPA**.

## Tech Stack

- **Runtime/Package Manager**: Bun
- **Framework**: React 19 + Vite 7
- **Language**: TypeScript (strict null checks off)
- **Styling**: Tailwind CSS 3 + shadcn/ui (Radix primitives)
- **State/Data**: TanStack Query (React Query) v5
- **Routing**: React Router v6
- **Validation**: Zod v4
- **Linting**: ESLint 9 flat config + typescript-eslint + sonarjs + react-hooks
- **Deployment**: Vercel

## Commands

- `bun dev` — dev server
- `bun build` — production build
- `bun lint` — lint

## Project Structure

```
src/
├── config/config.ts    # Single source for all environment variables
├── components/         # Reusable components
│   └── ui/             # shadcn/ui primitives
├── contexts/           # React context providers (AuthContext)
├── hooks/              # Custom hooks (useApi.ts is the main data layer)
├── layouts/            # Page layout shells
├── lib/
│   ├── api/            # API client, endpoint functions, types
│   ├── validations/    # Zod schemas
│   ├── flags.ts        # Feature flags
│   ├── constants.ts    # App-wide constants
│   └── queryKeys.ts    # TanStack Query key registry
├── pages/              # Route-level page components
│   ├── auth/           # Login, register, forgot/reset password
│   └── landing/        # Marketing/landing pages
└── utils/              # Pure utility functions
```

## Conventions

### Environment Variables

All `import.meta.env` access MUST go through `src/config/config.ts`. No other file should reference `import.meta.env` directly. Consumers import the config object:

```ts
import config from "@/config/config";
```

### Imports

- Use `@/` path alias (maps to `src/`).
- Use named imports from `react` — never `import * as React`.
- Group: external packages → `@/` internal → relative.

### Components

- Pages are default-exported from `src/pages/`.
- Reusable UI uses shadcn/ui conventions (`components/ui/`).
- Props should be read-only (enforced via `sonarjs/prefer-read-only-props`).

### Data Fetching

- All API functions live in `src/lib/api/` and use the shared `apiClient` from `client.ts`.
- Hooks wrapping queries/mutations live in `src/hooks/useApi.ts`.
- Query keys are centralized in `src/lib/queryKeys.ts`.

### Styling

- Tailwind utility classes. No CSS modules.
- CSS variables for theming (defined in `src/index.css`).
- `class-variance-authority` for component variants.
- `tailwind-merge` + `clsx` via the `cn()` helper in `src/lib/utils.ts`.

### Error Handling

- API errors are typed as `ApiError` (from `src/lib/api/types`).
- Mutations use `onError` callbacks with toast notifications.

### Forms

- Controlled components with `useState`.
- Zod schemas in `src/lib/validations/` for complex validation.
- Native HTML validation attributes (`required`, `type="email"`) for simple cases.

### Feature Flags

- Flagsmith for runtime flags.
- Build-time flags via `src/lib/flags.ts` (reads from config).
