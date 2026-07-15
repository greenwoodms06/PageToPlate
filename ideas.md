# Ideas — PageToPlate

- Linked-pack curation pipeline (archive.org triage → page-map resolution → pack JSON + CI schema check) — deferred from v1; schema slots already exist (`Recipe.link`, pack `link` field, `verifiedPagesOnly` setting).
- Additional rating display scales (e.g. 1–100) — storage is canonical 1–10; adding display options needs no migration. Owner floated 2026-07-15; deliberately limited to 5/10 in v1.
- In-file duplicate rows that differ by category (5 of ATK's 10 dupes) could carry both categories as tags instead of keep-first — revisit if users notice.
