# Witness Log — PageToPlate

This project's Witness log. Append-only, chronological. Entries are added, never
modified (except `STATUS` updates). Sequential IDs never reset: `P2P-001`,
`P2P-002`, …

Entry format and types: see
`/mnt/d/Projects/Soul-System/operations/witness-log-format.md`.

---

```
ID:           P2P-001
WHEN:         2026-07-14 / v1 build / Milestones E–F
WHERE:        src/components/overlay.ts > usePopstateClose
WHAT:         Two distinct defects in one hook, found in separate milestones: StrictMode
              double-mount closed overlays that open on mount; a stacked dialog's
              programmatic close-popstate was read by the parent sheet as a user back-press.
TYPE:         Failure Mode — hash-history overlay management (same WHERE, twice)
CONSEQUENCE:  Both caught by browser-driven verification before commit; fixed at the site.
STATUS:       Resolved
```

---

```
ID:           P2P-002
WHEN:         2026-07-14 / v1 build / Milestone E review
WHERE:        src/data/types.ts > todayISO
WHAT:         toISOString().slice(0,10) returned the UTC date; evening entries in US
              timezones would journal under tomorrow. Surfaced when a subagent's demo
              run showed Jul 15 on Jul 14.
TYPE:         Universe Contradiction — "ISO date = today" assumption vs timezones
CONSEQUENCE:  Fixed before any real user data existed.
STATUS:       Resolved
```

---

```
ID:           P2P-003
WHEN:         2026-07-14–15 / v1 build / Milestones G–H
WHERE:        src/logic/importer.ts + background/atk_index.csv
WHAT:         Real index data violated import assumptions twice: 15 same-name/
              different-page recipe pairs (dedupe cross-updated their pages) and 10
              exact name+page duplicate rows (double-entered on first install).
TYPE:         Universe Contradiction — real data vs name-keyed dedupe
CONSEQUENCE:  Two TDD fixes (page tiebreaker; in-file seen-set); pack rebuilt 1645→1635.
STATUS:       Resolved
```

---

```
ID:           P2P-004
WHEN:         2026-07-14 / v1 build / Checkpoint 1
WHERE:        src/styles/tokens.css > --rejected-fill (dark)
WHAT:         Token was flagged as missing a dark value at Milestone A (recorded in the
              Task 2 agent report) but shipped unfixed; owner hit it as unreadable text
              at the first demo. Screenshot passes had not exercised a dark rejected state.
TYPE:         Failure Mode — flagged-but-unscheduled defect surfaced to owner
CONSEQUENCE:  One owner-visible defect; fixed same day. Flags need owners, not just notes.
STATUS:       Resolved
```

---

```
ID:           P2P-005
WHEN:         2026-07-15 / post-deploy / owner device use
WHERE:        src/screens/settings/BackupRestore.tsx > doExport share path, on Android Chrome
WHAT:         Owner reports backup export goes straight to download; no share picker
              appears. Code tries navigator.share first; canShare({files}) evidently
              returns false on the device for our .json/.zip files.
TYPE:         Universe Contradiction — "share({files}) works on Android" vs Chromium's
              file-extension allowlist (hypothesis: .json/.zip excluded; unverified)
CONSEQUENCE:  Backups reach Downloads only; Drive/copy targets unavailable. Unresolved.
STATUS:       Resolved — hypothesis confirmed; fix d635a3e (.ptp.txt costume);
              owner verified the share sheet on device 2026-07-15.
```

---

```
ID:           P2P-006
WHEN:         2026-07-15 / post-deploy / owner device use
WHERE:        src/screens/settings/BackupRestore.tsx > restore file input accept attribute
WHAT:         Android's document picker, driven by the input's accept MIME mapping,
              refused the .ptp.txt backup the app itself had just exported. Second
              owner-found defect in the backup flow in one day (after P2P-005).
TYPE:         Universe Contradiction — accept filter assumed helpful; on-device it
              blocked the app's own artifact
CONSEQUENCE:  Restore unusable on device until filter removed (e315e1d). Restore
              validates by content, so the filter added risk without safety.
STATUS:       Resolved — pending owner's on-device picker retest
```

---
