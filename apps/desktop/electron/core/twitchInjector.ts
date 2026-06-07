import { Page } from 'playwright-core';

export async function injectTwitch(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');

  // Bannière de cookies — attend jusqu'à 6s qu'elle apparaisse puis l'accepte.
  await page.waitForSelector('[data-a-target="consent-banner-accept"]', { timeout: 6000 })
    .then(() => page.click('[data-a-target="consent-banner-accept"]'))
    .catch(() => {}); // absente si cookies déjà acceptés

  // Portail de classification (contenu adulte/mature).
  await page.click('[data-a-target="content-classification-gate-overlay-start-watching-button"]')
    .catch(() => {});

  // Coupe le son — les instances de boost ne doivent pas lire l'audio.
  await page.evaluate(() => {
    const v = document.querySelector<HTMLVideoElement>('video');
    if (v) v.muted = true;
  }).catch(() => {});

  // Qualité minimale via l'interface du lecteur.
  // localStorage a déjà été défini avant le chargement (addInitScript dans sessionManager),
  // mais on essaie aussi via l'UI en cas de rechargement ou de mise à jour du lecteur.
  await setMinQualityViaUI(page);
}

async function setMinQualityViaUI(page: Page): Promise<void> {
  try {
    // Attend que le player soit prêt (bouton settings visible).
    await page.waitForSelector('[data-a-target="player-settings-button"]', { timeout: 8000 });

    // Ouvre les paramètres.
    await page.click('[data-a-target="player-settings-button"]');
    await page.waitForTimeout(400);

    // Clique sur "Qualité".
    await page.click('[data-a-target="player-settings-menu-item-quality"]');
    await page.waitForTimeout(400);

    // Sélectionne la dernière option (qualité la plus basse).
    await page.evaluate(() => {
      const options = document.querySelectorAll<HTMLElement>(
        '[data-a-target^="player-settings-submenu-quality-option"]',
      );
      if (options.length > 0) options[options.length - 1].click();
    });

    // Ferme le menu.
    await page.keyboard.press('Escape');
  } catch {
    // Le lecteur n'est pas encore prêt ou la structure a changé — on continue.
  }
}

/**
 * Lit le nombre de spectateurs actuels affiché sur la page Twitch.
 * Retourne null si l'élément est absent ou non parseable.
 */
export async function getTwitchViewerCount(page: Page): Promise<number | null> {
  try {
    const text = await page.$eval(
      '[data-a-target="animated-channel-viewers-count"]',
      (el) => el.textContent?.trim() ?? '',
    );
    return parseViewerCount(text);
  } catch {
    return null;
  }
}

function parseViewerCount(text: string): number | null {
  if (!text) return null;
  // Normalise les espaces insécables et les séparateurs de milliers, puis la virgule décimale.
  const cleaned = text.replace(/\s/g, '').replace(/ /g, '').toLowerCase();
  const match = cleaned.match(/^([\d.,]+)([kmb]?)$/);
  if (!match) return null;
  const num = parseFloat(match[1].replace(',', '.'));
  if (isNaN(num)) return null;
  const multipliers: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };
  return Math.round(num * (multipliers[match[2]] ?? 1));
}
