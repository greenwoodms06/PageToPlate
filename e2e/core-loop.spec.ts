// The spec's core loop as ONE journey on one page (plan Task 29): CSV import
// → generate wizard → results triage (reject/never + regenerate, checkpoint-1
// amendment: regenerate replaces never'd cards too) → plan → mark made →
// calendar → browse/tag edit → reload (IndexedDB survival) → backup export.
//
// Fixture hand-counts (e2e/fixtures/mini.csv — recompute if it changes):
// 12 rows; 'Puddings' → Desserts (synonym), 'Appetizers & Small Plates' →
// Sides (+ appetizer tag); 'Garlic Green Beans' p.60 appears twice — an
// exact name+page duplicate pair. planImport skips in-file repeats (never
// double-enter, even into a fresh book), so the preview plans 11 adds /
// 1 duplicate and commit stores 11: Mains 4, Desserts 4, Sides 2,
// Soups & Stews 1. 'chocolate' matches 2 of the 4 Desserts by name.
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const CSV = fileURLToPath(new URL('./fixtures/mini.csv', import.meta.url));
const pad2 = (n: number) => String(n).padStart(2, '0');

test('core loop: import → generate → plan → made → browse → persist → backup', async ({ page }) => {
  // ── Books → Import CSV → preview ──────────────────────────────────────
  await page.goto('#/books');
  await page.getByText('Import CSV').click();
  await page.getByTestId('csv-file-input').setInputFiles(CSV);

  const summary = page.getByTestId('import-summary');
  await expect(summary).toContainText('12 recipes found');
  await expect(summary).toContainText('4 categories');
  await expect(summary).toContainText('1 duplicate'); // the in-file Garlic Green Beans pair
  // Appetizer synonym row maps to Sides (sample shows the first 8 rows).
  const eggsRow = page.getByText('Deviled Eggs').locator('..');
  await expect(eggsRow).toContainText('p. 12');
  await expect(eggsRow).toContainText('Sides');

  // ── import → book lands on the shelf ──────────────────────────────────
  await page.getByText('Import 11 recipes').click();
  await expect(page).toHaveURL(/#\/books\/.+/); // commit routes to book detail
  await page.goto('#/books');
  const bookCard = page.getByText('mini', { exact: true }).locator('..');
  await expect(bookCard).toContainText('11 recipes');

  // ── Generate step 1: select the book ──────────────────────────────────
  await page.goto('#/generate');
  await page.getByText('mini', { exact: true }).click();
  await page.getByText('Next: categories').click();

  // ── step 2: Mains 2 + Desserts 1 with pill 'chocolate' ────────────────
  const mains = page.locator('[data-category="Mains"]');
  await mains.getByLabel('Increase').click();
  await mains.getByLabel('Increase').click();
  await expect(mains.getByTestId('availability')).toHaveText('4 available');

  const desserts = page.locator('[data-category="Desserts"]');
  await desserts.getByLabel('Increase').click();
  await page.getByLabel('Filters for Desserts').click();
  await desserts.getByPlaceholder('Type a keyword, return adds a pill…').fill('chocolate');
  await desserts.getByPlaceholder('Type a keyword, return adds a pill…').press('Enter');
  await expect(desserts.getByTestId('availability')).toHaveText('2 match'); // Lava Cake + Skillet Cookie

  // ── results: 3 cards grouped 2 Mains + 1 Dessert ──────────────────────
  await page.getByText('Generate 3 recipes').click();
  await expect(page.getByText('Your picks')).toBeVisible();
  await expect(page.getByText('2 of 2')).toBeVisible();
  await expect(page.getByText('1 of 1')).toBeVisible();
  const cards = page.locator('[data-recipe-id]');
  await expect(cards).toHaveCount(3);
  // DOM order follows category order: [0],[1] Mains, [2] Dessert.
  const mainA = (await cards.nth(0).getAttribute('data-recipe-id'))!;
  const mainB = (await cards.nth(1).getAttribute('data-recipe-id'))!;
  const nameA = (await cards.nth(0).innerText()).replace(/\s+/g, ' ');
  const nameB = (await cards.nth(1).innerText()).replace(/\s+/g, ' ');

  // ── reject one Main; '↻ Regenerate 1' replaces ONLY it ────────────────
  await page.locator(`[data-recipe-id="${mainA}"]`).getByText('Reject', { exact: true }).click();
  await expect(page.getByText('1 of 2')).toBeVisible();
  await page.getByText('↻ Regenerate 1').click();
  await expect(page.getByText('2 of 2')).toBeVisible();
  await expect(cards).toHaveCount(3);
  await expect(page.locator(`[data-recipe-id="${mainA}"]`)).toHaveCount(0); // replaced…
  await expect(page.locator(`[data-recipe-id="${mainB}"]`)).toHaveCount(1); // …but B kept
  // regenerate() keeps kept cards first and APPENDS replacements, so the
  // Mains group is now [B, C] — the new card sits at index 1.
  const mainC = (await cards.nth(1).getAttribute('data-recipe-id'))!;
  expect(mainC).not.toBe(mainA);
  const nameC = (await cards.nth(1).innerText()).replace(/\s+/g, ' ');
  expect(nameC).not.toBe(nameA);

  // ── never-make the other Main: toast + regenerate replaces it too ─────
  // (Checkpoint-1 amendment 4: regenerate covers never'd cards as well.)
  await page.locator(`[data-recipe-id="${mainB}"]`).getByText('Never', { exact: true }).click();
  await expect(page.getByText('marked never make')).toBeVisible(); // toast…
  await expect(page.getByText('Undo', { exact: true })).toBeVisible(); // …with Undo
  await page.getByText('↻ Regenerate 1').click();
  await expect(page.locator(`[data-recipe-id="${mainB}"]`)).toHaveCount(0);
  await expect(page.locator(`[data-recipe-id="${mainC}"]`)).toHaveCount(1);
  await expect(cards).toHaveCount(3);
  const mainD = (await cards.nth(1).getAttribute('data-recipe-id'))!;
  expect(mainD).not.toBe(mainB);
  const nameD = (await cards.nth(1).innerText()).replace(/\s+/g, ' ');
  expect(nameD).not.toBe(nameB);

  // ── plan these 3 → Plans tab shows the plan ───────────────────────────
  await page.getByText('Plan these 3').click();
  await expect(page.getByText('Plan created')).toBeVisible();
  await page.getByText('View plan in Plans').click();
  const now = new Date();
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  await expect(page.getByText(`Planned ${monthDay} · 3 recipes`)).toBeVisible();

  // ── mark one made, rating 8 → row shows 'Made · 8/10' ─────────────────
  await page.getByText('Made ✓').first().click();
  await expect(page.getByText('Mark as made')).toBeVisible();
  await page.getByRole('button', { name: '8', exact: true }).click();
  await page.getByText(/Save · Made/).click();
  await expect(page.getByText('Made · 8/10')).toBeVisible();

  // ── calendar: today carries the plan ring AND the made dot ────────────
  await page.getByText('Calendar', { exact: true }).click();
  const todayIso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const todayCell = page.getByRole('button', { name: todayIso, exact: true });
  await expect(todayCell.locator('i')).toHaveCount(2); // ring (plan) + dot (made)

  // ── browse: pill search → recipe sheet → add a tag ────────────────────
  await page.goto('#/browse');
  await page.getByPlaceholder('⌕ add keyword…').fill('parmesan');
  await page.getByPlaceholder('⌕ add keyword…').press('Enter');
  await page.getByText('Chicken Parmesan').click();
  await page.getByPlaceholder('+ add tag…').fill('e2etag');
  await page.getByPlaceholder('+ add tag…').press('Enter');
  await expect(page.getByLabel('e2etag — tap to flip include/not')).toBeVisible(); // the tag pill
  await page.keyboard.press('Escape'); // sheet closes via overlay Escape

  // ── RELOAD: the tag survives in IndexedDB ─────────────────────────────
  await page.reload();
  await page.goto('#/browse');
  await page.getByPlaceholder('⌕ add keyword…').fill('e2etag');
  await page.getByPlaceholder('⌕ add keyword…').press('Enter');
  await expect(page.getByText('Chicken Parmesan')).toBeVisible(); // pill matches the persisted tag

  // ── settings backup: export triggers a download ───────────────────────
  await page.goto('#/settings/backup');
  const downloadPromise = page.waitForEvent('download');
  await page.getByText('Export backup file').click();
  const download = await downloadPromise;
  // No photo attachments in this journey → plain JSON container.
  expect(download.suggestedFilename()).toMatch(/^pagetoplate-backup-\d{4}-\d{2}-\d{2}\.json$/);
});
