// Swipe tab navigation (round-1 amendment 3; interactive pager since
// round 3): a horizontal drag pans between the four main tabs — fast flicks
// commit under the original ≥70px/<600ms rule, slow drags commit at ≥35% of
// the column width. It must NOT fire from inside a horizontally scrollable
// element (e.g. Browse's filter-chip row — scrolling chips is not a tab
// switch). Touch is emulated through CDP Input.dispatchTouchEvent so the
// events hit-test to real targets, exercising TabPager's guard walk.
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Fast (<600ms) horizontal touch flick via CDP — real targets, real events. */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  const steps = 4;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}


/** The splash (min-hold + fade, round 3) is swipe-inert and sits on top at
 * launch — gestures must wait it out, exactly like a real thumb would. */
async function splashGone(page: Page): Promise<void> {
  await expect(page.getByTestId('splash')).toHaveCount(0);
}

test('swipe left on Generate lands on Plans; no wrap on a right swipe', async ({ page }) => {
  await page.goto('#/generate');
  await splashGone(page);
  const nav = page.locator('nav');
  await expect(nav).toBeVisible();

  // Swipe inside main's bottom padding (just above the nav) — guaranteed
  // clear of inputs and scrollable rows on every tab.
  const navBox = (await nav.boundingBox())!;
  const y = navBox.y - 40;

  // Generate is the LEFTMOST tab: wrap is off, a right swipe must do nothing.
  await swipe(page, { x: 60, y }, { x: 330, y });
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/#\/generate/);

  // Left swipe → the adjacent tab (Plans).
  await swipe(page, { x: 330, y }, { x: 60, y });
  await expect(page).toHaveURL(/#\/plans/);
  await expect(page.getByText('open plans')).toBeVisible(); // Plans stat strip rendered
});

test('slow long drag commits too (interactive pager, not just flicks)', async ({ page }) => {
  await page.goto('#/generate');
  await splashGone(page);
  const nav = page.locator('nav');
  await expect(nav).toBeVisible();
  const navBox = (await nav.boundingBox())!;
  const y = navBox.y - 40;

  // ~250px left over ~900ms: fails the old flick rule (<600ms) but clears
  // the pager's 35%-of-390px distance threshold — pins that a slow drag now
  // navigates instead of snapping back.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 320, y }] });
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    await page.waitForTimeout(180);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 320 - (250 * i) / steps, y }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await expect(page).toHaveURL(/#\/plans/);
});

test.describe('narrow viewport (filter-chip row overflows)', () => {
  // 320px: Books/Categories/★ Rating outgrow the row, so it really scrolls
  // horizontally — the exact surface the amendment says must not misfire.
  test.use({ viewport: { width: 320, height: 844 } });

  test('swipe starting on Browse’s scrollable chip row does NOT change tabs', async ({ page }) => {
    await page.goto('#/browse');
    await splashGone(page);
    const row = page.getByTestId('filter-drop-row');
    await expect(row).toBeVisible();

    // Precondition for the guard: the row genuinely overflows. If a style
    // change ever makes it fit, this fails HERE, not silently downstream.
    expect(await row.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeGreaterThan(2);

    const box = (await row.boundingBox())!;
    const y = box.y + box.height / 2;
    await swipe(page, { x: box.x + box.width - 15, y }, { x: box.x + 15, y });
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/#\/browse/); // stayed put

    // Same gesture from neutral ground still navigates (Browse → Books),
    // proving the stay-put above was the guard, not a dead hook.
    const navBox = (await page.locator('nav').boundingBox())!;
    await swipe(page, { x: 280, y: navBox.y - 40 }, { x: 20, y: navBox.y - 40 });
    await expect(page).toHaveURL(/#\/books/);
  });
});
