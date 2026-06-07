import { chromium, Browser, BrowserContext } from 'playwright-core';
import { detectPlatform } from './platformDetector';
import { injectTwitch } from './twitchInjector';
import { injectYoutube } from './youtubeInjector';
import { injectKick } from './kickInjector';
import { injectTiktok } from './tiktokInjector';

export interface SessionConfig {
  sessionId: string;
  streamUrl: string;
  proxies: Array<{ index: number; address: string }>;
  onScreenshot?: (index: number, png: Buffer) => void;
}

export interface ActiveSession {
  sessionId: string;
  contexts: BrowserContext[];
  heartbeatTimer: NodeJS.Timer;
}

const SCREENSHOT_INTERVAL_MS = 5000;

export class SessionManager {
  private browser: Browser | null = null;
  private activeSessions = new Map<string, ActiveSession>();

  async start(
    config: SessionConfig,
    heartbeatFn: () => Promise<void>,
  ): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }

    const platform = detectPlatform(config.streamUrl);
    const injector = this.getInjector(platform);

    const contexts: BrowserContext[] = [];

    try {
      for (const proxy of config.proxies) {
        const [protocol, rest] = proxy.address.replace('://', '@@').split('@@');
        // Use lastIndexOf so passwords containing '@' are handled correctly.
        const lastAt = rest.lastIndexOf('@');
        const credentials = lastAt >= 0 ? rest.substring(0, lastAt) : '';
        const hostPort = lastAt >= 0 ? rest.substring(lastAt + 1) : rest;
        // Use indexOf so passwords containing ':' are handled correctly (only first colon splits user/pass).
        const colonIdx = credentials.indexOf(':');
        const username = colonIdx >= 0 ? credentials.substring(0, colonIdx) : credentials;
        const password = colonIdx >= 0 ? credentials.substring(colonIdx + 1) : '';

        const ctx = await this.browser.newContext({
          proxy: {
            server: `${protocol}://${hostPort}`,
            username: username || undefined,
            password: password || undefined,
          },
        });
        contexts.push(ctx); // push early so cleanup catches it on error

        const page = await ctx.newPage();
        // addInitScript must run BEFORE goto — it only applies to the next navigation.
        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });
        await page.goto(config.streamUrl, { waitUntil: 'domcontentloaded' });
        await injector(page);

        if (config.onScreenshot) {
          const captureLoop = async () => {
            while (this.activeSessions.has(config.sessionId)) {
              try {
                const png = await page.screenshot({ type: 'png' });
                config.onScreenshot!(proxy.index, png);
              } catch {}
              await new Promise((r) => setTimeout(r, SCREENSHOT_INTERVAL_MS));
            }
          };
          captureLoop().catch(() => {});
        }
      }
    } catch (err) {
      // Nettoyage des contextes partiellement créés avant de propager l'erreur
      for (const ctx of contexts) {
        await ctx.close().catch(() => {});
      }
      throw err;
    }

    const heartbeatTimer = setInterval(heartbeatFn, 30_000);

    this.activeSessions.set(config.sessionId, {
      sessionId: config.sessionId,
      contexts,
      heartbeatTimer,
    });
  }

  async stop(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    clearInterval(session.heartbeatTimer);
    for (const ctx of session.contexts) {
      await ctx.close().catch(() => {});
    }
    this.activeSessions.delete(sessionId);
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
}
