# Handoff — PageToPlate

**Cursor (2026-07-15):** v1 built, deployed, and live at
https://greenwoodms06.github.io/PageToPlate/ (GitHub Pages via Actions; Pages
source must stay "GitHub Actions" — branch mode serves raw source and broke the
site once). All 30 plan tasks + three owner amendment rounds done. 127 unit
tests + 3 Playwright E2E green at HEAD.

**Read first:** docs/superpowers/plans/2026-07-14-pagetoplate-v1.md — the plan
plus its amendment sections are the decision record. witness.md has P2P-001..004.

**Next session (owner-agreed):** archive.org linked-pack curation pipeline —
see ideas.md "Next session". Expect manual per-book intervention.

**Open/unverified:** on-device Android behaviors (share-sheet export, share
cancel keeping the backup nudge, swipe feel) — owner verifies in normal use.
Owner is separately re-verifying ATK pack data offline; corrections arrive as a
pack version bump.

**Gotchas for the next session:** repo lives on /mnt/d (WSL drvfs) — Vite dev
server does NOT hot-reload (restart it); npm is slow (generous timeouts); gh CLI
token was expired (owner did Pages switches by hand).
