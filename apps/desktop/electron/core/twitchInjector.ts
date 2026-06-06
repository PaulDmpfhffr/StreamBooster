import { Page } from 'playwright-core';

export async function injectTwitch(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.waitForLoadState('domcontentloaded');

  await page.evaluate(() => {
    const acceptBtn = document.querySelector<HTMLButtonElement>(
      '[data-a-target="consent-banner-accept"]',
    );
    if (acceptBtn) acceptBtn.click();
  }).catch(() => {});

  await page.evaluate(() => {
    const ageBtn = document.querySelector<HTMLButtonElement>(
      '[data-a-target="content-classification-gate-overlay-start-watching-button"]',
    );
    if (ageBtn) ageBtn.click();
  }).catch(() => {});

  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    try {
      const videoEl = document.querySelector<HTMLVideoElement>('video');
      if (videoEl) videoEl.muted = true;

      const reactInstance = (
        document.querySelector('[data-a-target="player-overlay-click-handler"]') as any
      )?._reactFiber?.return?.stateNode;

      if (reactInstance?.props?.mediaPlayerInstance) {
        const player = reactInstance.props.mediaPlayerInstance;
        player.setQuality('160p30');
      }
    } catch {}
  });
}
