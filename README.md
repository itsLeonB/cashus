# Cashus

**Split Expenses, Track Debts, Never Forget.**

Cashus is a modern web application designed to make financial interactions with friends effortless — tracking who owes what for shared expenses, trips, and rent.

This is a monorepo containing:

- [`frontend/`](frontend/README.md) — React 19 + Vite SPA
- [`backend/`](backend/README.md) — Go API (Gin + GORM)

See each component's own README for its setup and development commands.

## Root-level tooling

`make lint` / `make test` / `make vulncheck` / `make build-all` wrap both components' own tooling, running only against whichever component changed. `make install-pre-push-hook` installs a git pre-push hook that runs the same checks automatically before every push.

## License

MIT — see [LICENSE](LICENSE).
