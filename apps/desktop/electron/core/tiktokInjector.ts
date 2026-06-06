import { Page } from 'playwright-core';

export async function injectTiktok(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    try {
      const video = document.querySelector<HTMLVideoElement>('video');
      if (video) video.muted = true;
    } catch {}
  });
}
