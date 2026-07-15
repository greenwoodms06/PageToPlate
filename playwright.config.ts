// E2E config (plan Task 29). Runs against the PRODUCTION preview build:
// webServer builds first, so `npx playwright test` works from a clean
// checkout (no prebuilt dist required) — hence the generous server timeout.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  // One journey test on one shared page — workers/retries stay minimal.
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/PageToPlate/',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // Pixel-5-ish mobile profile at the 390x844 design viewport.
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173/PageToPlate/',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
