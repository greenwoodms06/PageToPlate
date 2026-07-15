# Ideas — PageToPlate

- Linked-pack curation pipeline (archive.org triage → page-map resolution → pack JSON + CI schema check) — deferred from v1; schema slots already exist (`Recipe.link`, pack `link` field, `verifiedPagesOnly` setting).
- Additional rating display scales (e.g. 1–100) — storage is canonical 1–10; adding display options needs no migration. Owner floated 2026-07-15; deliberately limited to 5/10 in v1.
- In-file duplicate rows that differ by category (5 of ATK's 10 dupes) could carry both categories as tags instead of keep-first — revisit if users notice.

## Next session (agreed 2026-07-15)
- **Archive.org content packs**: seed catalog from `collection:cbk` public-domain items (advanced-search API), triage each candidate's `_djvu.txt` for a CONTENTS/INDEX section, resolve printed page numbers against the book's `pageNums` leaf map for verified deep links, auto-draft packs for human review. Expect manual intervention per book (OCR quality varies). Spec §Content Packs has the verified technical basis; schema slots (`Recipe.link`, `pageStatus`, `verifiedPagesOnly`) already shipped.
- Owner offline in parallel: second verification of the ATK pack (recipes/pages/categories) + review of shipped default filter chips against real use. Corrections flow into a pack version bump (`updatePack` is non-destructive and already tested).
- **Backup share picker on Android (P2P-005)**: verify the Chromium Web Share file-extension allowlist hypothesis (.json/.zip not shareable); if confirmed, candidate fix: ship the backup with a shareable extension/MIME (restore already detects content by PK magic bytes, not extension, so renaming is safe) — verify on the owner's device.
