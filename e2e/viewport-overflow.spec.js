import { test, expect } from '@playwright/test';

const PHONE_SIZES = [
  { width: 375, height: 812, label: 'iPhone SE (375)' },
  { width: 390, height: 844, label: 'iPhone 14 (390)' },
];

const noOverflow = async (page) => {
  const overflows = await page.evaluate(() =>
    document.documentElement.scrollWidth === window.innerWidth
  );
  expect(overflows, 'page is wider than viewport').toBe(true);
};

for (const { width, height, label } of PHONE_SIZES) {
  test.describe(label, () => {
    test.use({ viewport: { width, height } });

    test('list view does not overflow', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await noOverflow(page);
    });

    test('open story does not overflow', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const firstCard = page.locator('[data-story-id]').first();
      await firstCard.click();
      await page.waitForTimeout(300);
      await noOverflow(page);
    });

    test('settings open does not overflow', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      // gear / settings button
      const gearBtn = page.locator('button[aria-label="Settings"], button[title="Settings"]').first();
      await gearBtn.click();
      await page.waitForTimeout(200);
      await noOverflow(page);
    });
  });
}
