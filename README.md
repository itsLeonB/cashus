# Cashus

**Split Expenses, Track Debts, Never Forget.**

Cashus is a modern web application designed to make financial interactions with friends effortless — tracking who owes what for shared expenses, trips, and rent.

This is a monorepo containing:

- [`frontend/`](frontend/README.md) — React 19 + Vite SPA
- [`backend/`](backend/README.md) — Go API (Gin + GORM)

See each component's own README for its setup and development commands.

## Root-level tooling

`make lint` / `make test` / `make vulncheck` / `make build-all` wrap both components' own tooling, running only against whichever component changed. `make install-pre-push-hook` installs a git pre-push hook that runs the same checks automatically before every push. `make install-language-servers` installs the Go and TypeScript language servers used by Serena MCP — useful in environments (e.g. Claude Code cloud sessions) where they aren't installed by default.

## Preview deployments

Every pull request gets a temporary Neon + Railway + Vercel preview stack — see [`docs/deployment/preview-environments.md`](docs/deployment/preview-environments.md) for how it works and [`scripts/setup-preview-environments.sh`](scripts/setup-preview-environments.sh) for the one-time credential setup.

## License

GNU Affero General Public License v3.0 (AGPL-3.0) — see [LICENSE](LICENSE).
