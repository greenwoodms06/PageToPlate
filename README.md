# PageToPlate

A meal planning companion that helps you actually use your physical cookbooks — without the meal-planning decision paralysis.

**Live app:** https://greenwoodms06.github.io/PageToPlate/ (installable PWA, works offline)

## What it does

You catalog recipe names and page numbers from your cookbooks (CSV import, content packs, or by hand). PageToPlate then:

- **Generates meal plans** — "2 mains and a dessert from these 3 books" — preferring recipes you haven't made yet, with per-category keyword filters (`chicken`, `not fried`)
- **Tracks what you cooked** — dates, 1–10 ratings (displayable as 1–5), photos, notes; a calendar journal of plans and cooking days
- **Browses your whole collection** — pill search across recipe names and tags, by book, category, status, and rating
- **Ships content packs** — pre-built recipe indexes you install in one tap (index-only packs for books you own; linked packs for public-domain books, readable free via archive.org)

All data lives in your browser (IndexedDB) — no accounts, no backend. One-tap backup/restore is built in; back up regularly.

## Development

```bash
npm install
npm run dev        # dev server
npm run test       # unit tests (Vitest)
npm run e2e        # end-to-end (Playwright; builds + previews itself)
npm run build      # production build to dist/
```

Deployment is automatic: pushes to `main` run tests, build, and publish to GitHub Pages via Actions.

## Repo layout

- `src/` — the app (React + TypeScript + Vite; plain CSS design tokens)
- `public/packs/` — content-pack catalog and pack files
- `tools/` — pre-import cleanup scripts and the pack builder (`build_pack.py`); see `tools/README.md`
- `background/design_handoff_pagetoplate/` — the product spec and design handoff this app was built from
- `docs/superpowers/plans/` — the implementation plan and its owner-amendment record

## Contributing packs

Content packs are JSON files validated against the format documented in `tools/README.md`, produced from a cookbook's table of contents (the in-app AI-help page describes the workflow). Pull requests welcome; every pack needs a human sanity pass — OCR of older books is messy.

## Credits & license

Linked content packs courtesy of the [Internet Archive](https://archive.org)'s Cookbook and Home Economics collection.

MIT — see [LICENSE](LICENSE).
