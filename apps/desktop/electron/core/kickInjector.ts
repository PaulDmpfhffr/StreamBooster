import { Page } from 'playwright-core';

export async function injectKick(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    try {
      const video = document.querySelector<HTMLVideoElement>('video');
      if (video) video.muted = true;
    } catch {}
  });
}
