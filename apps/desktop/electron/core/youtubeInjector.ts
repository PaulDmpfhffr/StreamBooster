import { Page } from 'playwright-core';

export async function injectYoutube(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.waitForLoadState('domcontentloaded');

  await page.evaluate(() => {
    const consentBtn = document.querySelector<HTMLButtonElement>(
      'button[aria-label*="Accept"], .eom-buttons button',
    );
    if (consentBtn) consentBtn.click();
  }).catch(() => {});

  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    try {
      const video = document.querySelector<HTMLVideoElement>('video');
      if (video) video.muted = true;

      const player = (document.getElementById('movie_player') as any);
      if (player?.setPlaybackQuality) player.setPlaybackQuality('small');
    } catch {}
  });
}
