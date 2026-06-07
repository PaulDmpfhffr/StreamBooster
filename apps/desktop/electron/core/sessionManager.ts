import { chromium, Browser, BrowserContext, Page } from 'playwright-core';
import { detectPlatform } from './platformDetector';
import { injectTwitch, getTwitchViewerCount } from './twitchInjector';
import { injectYoutube } from './youtubeInjector';
import { injectKick } from './kickInjector';
import { injectTiktok } from './tiktokInjector';

export interface SessionConfig {
  sessionId: string;
  streamUrl: string;
  proxies: Array<{ index: number; address: string }>;
  onScreenshot?: (index: number, png: Buffer) => void;
  onViewerCount?: (count: number | null) => void;
}

export interface ActiveSession {
  sessionId: string;
  contexts: BrowserContext[];
  heartbeatTimer: ReturnType<typeof setInterval>;
}

const SCREENSHOT_INTERVAL_MS = 5000;
const VIEWER_COUNT_INTERVAL_MS = 10_000;

export class SessionManager {
  private browser: Browser | null = null;
  private activeSessions = new Map<string, ActiveSession>();
  private sessionBytes = new Map<string, number>();

  getAndResetBytes(sessionId: string): number {
    const bytes = this.sessionBytes.get(sessionId) ?? 0;
    this.sessionBytes.set(sessionId, 0);
    return bytes;
  }

  async start(
    config: SessionConfig,
    heartbeatFn: () => Promise<void>,
  ): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }

    const platform = detectPlatform(config.streamUrl);
    const injector = this.getInjector(platform);
    const viewerCountFn = this.getViewerCountFn(platform);

    this.sessionBytes.set(config.sessionId, 0);

    const settled = await Promise.allSettled(
      config.proxies.map(async (proxy) => {
        const [protocol, rest] = proxy.address.replace('://', '@@').split('@@');
        const lastAt = rest.lastIndexOf('@');
        const credentials = lastAt >= 0 ? rest.substring(0, lastAt) : '';
        const hostPort = lastAt >= 0 ? rest.substring(lastAt + 1) : rest;
        const colonIdx = credentials.indexOf(':');
        const username = colonIdx >= 0 ? credentials.substring(0, colonIdx) : credentials;
        const password = colonIdx >= 0 ? credentials.substring(colonIdx + 1) : '';

        const ctx = await this.browser!.newContext({
          proxy: {
            server: `${protocol}://${hostPort}`,
            username: username || undefined,
            password: password || undefined,
          },
        });

        const page = await ctx.newPage();

        // Comptabilise les bytes réseau réels reçus.
        page.on('requestfinished', async (request) => {
          try {
            const sizes = await request.sizes();
            const current = this.sessionBytes.get(config.sessionId) ?? 0;
            this.sessionBytes.set(config.sessionId, current + sizes.responseBodySize);
          } catch {}
        });

        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
          // Twitch : impose la qualité minimale avant l'initialisation du lecteur.
          if (location.hostname.includes('twitch.tv')) {
            try { localStorage.setItem('video-quality', JSON.stringify({ default: '160p30' })); } catch {}
          }
        });

        await page.goto(config.streamUrl, { waitUntil: 'domcontentloaded' });
        await injector(page);

        return { ctx, page, index: proxy.index };
      }),
    );

    const succeeded: Array<{ ctx: BrowserContext; page: Page; index: number }> = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        succeeded.push(result.value);
      }
    }

    if (succeeded.length === 0) {
      this.sessionBytes.delete(config.sessionId);
      throw new Error('Aucune instance n\'a pu démarrer. Vérifiez vos proxies.');
    }

    const heartbeatTimer = setInterval(heartbeatFn, 30_000);

    this.activeSessions.set(config.sessionId, {
      sessionId: config.sessionId,
      contexts: succeeded.map((s) => s.ctx),
      heartbeatTimer,
    });

    for (const { page, index } of succeeded) {
      // Boucle de capture d'écran.
      if (config.onScreenshot) {
        const captureLoop = async () => {
          while (this.activeSessions.has(config.sessionId)) {
            try {
              const png = await page.screenshot({ type: 'png' });
              config.onScreenshot!(index, png);
            } catch {}
            await new Promise((r) => setTimeout(r, SCREENSHOT_INTERVAL_MS));
          }
        };
        captureLoop().catch(() => {});
      }
    }

    // Boucle de lecture du nombre de viewers sur la première instance uniquement
    // (toutes les instances regardent le même live).
    if (config.onViewerCount && viewerCountFn && succeeded.length > 0) {
      const firstPage = succeeded[0].page;
      const viewerLoop = async () => {
        while (this.activeSessions.has(config.sessionId)) {
          try {
            const count = await viewerCountFn(firstPage);
            config.onViewerCount!(count);
          } catch {}
          await new Promise((r) => setTimeout(r, VIEWER_COUNT_INTERVAL_MS));
        }
      };
      viewerLoop().catch(() => {});
    }
  }

  async stop(sessionId: string): Promise<number> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return 0;

    clearInterval(session.heartbeatTimer);
    for (const ctx of session.contexts) {
      await ctx.close().catch(() => {});
    }
    this.activeSessions.delete(sessionId);

    const remaining = this.sessionBytes.get(sessionId) ?? 0;
    this.sessionBytes.delete(sessionId);
    return remaining;
  }

  async stopAll(): Promise<void> {
    const ids = [...this.activeSessions.keys()];
    await Promise.allSettled(ids.map((id) => this.stop(id)));
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  private getInjector(platform: string) {
    switch (platform) {
      case 'youtube': return injectYoutube;
      case 'kick': return injectKick;
      case 'tiktok': return injectTiktok;
      default: return injectTwitch;
    }
  }

  private getViewerCountFn(platform: string): ((page: Page) => Promise<number | null>) | null {
    switch (platform) {
      case 'twitch': return getTwitchViewerCount;
      default: return null; // YouTube/Kick/TikTok à implémenter ultérieurement
    }
  }
}
