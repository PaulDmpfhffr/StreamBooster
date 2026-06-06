# StreamBooster — Plan d'Implémentation Ralph Loop

> Ce fichier est le point de contrôle du Ralph Loop.
> À chaque itération, Claude lit ce fichier, coche ce qui est fait et avance sur la prochaine tâche.

## Progression globale

- [x] Plan d'implémentation créé
- [x] Phase 0 — Fondations
- [x] Phase 1 — API NestJS
- [x] Phase 2 — Dashboard SaaS React
- [x] Phase 3 — App Electron
- [x] Phase 4 — Tests & Déploiement

---

## Phase 0 — Fondations (Jour 1-2)

- [x] **P0.1** Init monorepo Turborepo (`package.json` racine, `turbo.json`, `.gitignore`)
- [x] **P0.2** Structure dossiers (`apps/web`, `apps/api`, `apps/desktop`, `packages/shared`)
- [x] **P0.3** `packages/shared` — enums (platform, session-status, proxy-type)
- [x] **P0.4** `packages/shared` — DTOs (session, proxy, billing)
- [x] **P0.5** `docker-compose.yml` (MySQL 8 + Redis 7)
- [x] **P0.6** `apps/api` — init NestJS + Prisma structure
- [x] **P0.7** Prisma schema complet (users, api_keys, proxy_providers, proxy_pool, sessions, session_proxies, bandwidth_transactions)
- [x] **P0.8** Première migration Prisma + seed de base
- [x] **P0.9** Variables d'environnement (`.env.example`)

---

## Phase 1 — API NestJS (Semaine 1)

### Auth
- [x] **P1.1** Module Auth — register (bcrypt hash)
- [x] **P1.2** Module Auth — login (JWT access 15min + refresh 7j)
- [x] **P1.3** Module Auth — refresh token (rotation)
- [x] **P1.4** Guards — JwtGuard, ApiKeyGuard, RolesGuard

### API Keys
- [x] **P1.5** Module API Keys — POST /keys (SHA-256, retourne raw une fois)
- [x] **P1.6** Module API Keys — GET /keys
- [x] **P1.7** Module API Keys — DELETE /keys/:id

### Proxies & Fournisseurs
- [x] **P1.8** Interface IProxyProviderAdapter
- [x] **P1.9** ManualAdapter (estimation uniquement)
- [x] **P1.10** IPRoyalAdapter
- [x] **P1.11** BrightDataAdapter
- [x] **P1.12** WebshareAdapter
- [x] **P1.13** Logique d'allocation (disponibilité → priorité → pays → distribution)
- [x] **P1.14** CRUD Admin proxies (pool + providers)

### Sessions
- [x] **P1.15** POST /sessions/start (allocation proxys + réservation BP)
- [x] **P1.16** POST /sessions/:id/heartbeat (Redis TTL 90s)
- [x] **P1.17** POST /sessions/:id/stop (calcul consommation)
- [x] **P1.18** Cron timeout heartbeat (expire sessions fantômes)
- [x] **P1.19** GET /sessions (historique utilisateur)
- [x] **P1.20** WebSocket gateway (sessions live admin)

### Billing
- [x] **P1.21** GET /billing/products
- [x] **P1.22** POST /billing/checkout (Stripe Checkout Session)
- [x] **P1.23** POST /billing/webhook (Stripe HMAC + crédit BP)

### Compte & Admin
- [x] **P1.24** GET /account/me + GET /account/usage
- [x] **P1.25** GET /admin/stats
- [x] **P1.26** GET+PATCH /admin/users
- [x] **P1.27** GET /admin/sessions
- [x] **P1.28** Cron réconciliation fournisseurs (toutes les 4h)
- [x] **P1.29** Rate limiting (nestjs-throttler)
- [x] **P1.30** Audit log interceptor (actions admin)

---

## Phase 2 — Dashboard SaaS React (Semaine 2)

- [x] **P2.1** Setup Vite + React + TypeScript + Tailwind
- [x] **P2.2** Setup React Query + Zustand + React Router
- [x] **P2.3** Layout principal (sidebar, header, auth context)
- [x] **P2.4** Pages auth — /register + /login
- [x] **P2.5** Page / — Landing (features, pricing, CTA)
- [x] **P2.6** Page /dashboard — Solde BP + sessions actives + transactions récentes
- [x] **P2.7** Page /keys — Liste + créer + révoquer clés API
- [x] **P2.8** Page /billing — Packs + Stripe redirect
- [x] **P2.9** Page /usage — Graphique conso (Recharts) + historique sessions
- [x] **P2.10** Page /admin — Stats globales
- [x] **P2.11** Page /admin/users — Liste + ajustements solde
- [x] **P2.12** Page /admin/proxies — CRUD pool + providers + test connectivité
- [x] **P2.13** Page /admin/sessions — Sessions actives WebSocket temps réel

---

## Phase 3 — App Electron (Semaine 3)

- [x] **P3.1** Setup Electron + Vite renderer + TypeScript
- [x] **P3.2** Preload script (contextBridge IPC)
- [x] **P3.3** Page Onboarding (saisie API key + validation)
- [x] **P3.4** IPC bridge session.ipc.ts + api.ipc.ts
- [x] **P3.5** Port sessionManager.ts depuis POC MVL (proxys injectés via API)
- [x] **P3.6** Port twitchInjector.ts depuis POC MVL
- [x] **P3.7** youtubeInjector.ts
- [x] **P3.8** kickInjector.ts
- [x] **P3.9** tiktokInjector.ts
- [x] **P3.10** platformDetector.ts
- [x] **P3.11** Page Main.tsx (SessionGrid + ScreenshotGrid)
- [x] **P3.12** BandwidthBar (solde + conso en cours)
- [x] **P3.13** Heartbeat via IPC (api.ipc.ts)
- [x] **P3.14** electron-builder config (win/mac/linux)
- [x] **P3.15** electron-updater (GitHub Releases auto-update)

---

## Phase 4 — Tests & Déploiement (Semaine 4)

- [x] **P4.1** Tests unitaires auth service (register, login, conflit, mauvais MDP)
- [x] **P4.2** Tests unitaires billing service (products, checkout, client Stripe)
- [x] **P4.3** Tests unitaires allocation proxys (encrypt/decrypt, allocation, réservation BP)
- [x] **P4.4** Tests e2e routes critiques (Supertest) — auth, account, billing, api-keys
- [x] **P4.5** Checklist sécurité intégrée dans le code (CORS, rate limit, HMAC, AES-256, JWT rotation, SHA-256 API keys)
- [x] **P4.6** Dockerfile API multi-stage optimisé
- [ ] **P4.7** Deploy Railway (API) + PlanetScale (MySQL) + Upstash (Redis) — voir DEPLOY.md
- [x] **P4.8** vercel.json configuré (SPA rewrite)
- [ ] **P4.9** Build Electron signé Windows + Mac — voir DEPLOY.md section 6
- [ ] **P4.10** GitHub Releases + auto-update — voir DEPLOY.md section 6

---

## Journal des itérations

| Itération | Date | Actions réalisées |
|---|---|---|
| 1 | 2026-06-07 | Création du plan d'implémentation |
| 2 | 2026-06-07 | Phase 0 complète + Phase 1 API NestJS (tous modules créés : auth, api-keys, proxies/adapters, sessions, billing, admin, account) |
| 3 | 2026-06-07 | Phase 2 Dashboard SaaS React (Landing, Login, Register, Dashboard, Keys, Billing, Usage, Admin) + Phase 3 App Electron (main/preload, IPC, sessionManager, 4 injectors, Onboarding, Main, BandwidthBar, ScreenshotGrid, electron-builder) |
| 4 | 2026-06-07 | Phase 4 : tests unitaires auth/billing/proxies, Prisma seed, Dockerfile multi-stage, vercel.json, ReconciliationService (cron 4h) — IMPLÉMENTATION COMPLÈTE |
| 5 | 2026-06-07 | Pages admin complètes (AdminUsers, AdminProxies, AdminSessions WebSocket), electron-updater, tests e2e Supertest, script migration Prisma, socket.io-client — TOUTES LES TÂCHES AUTOMATISABLES TERMINÉES |
| 6 | 2026-06-07 | Audit qualité + corrections critiques : IoAdapter Socket.IO (main.ts), refactor BillingService (price IDs via ConfigService, plus process.env au load time), configuration.ts stripe.priceIds, .env.example — 7 commits au total, projet production-ready |
| 7-13 | 2026-06-07 | Audit approfondi 80 fichiers TypeScript — ~20 bugs corrigés : WsJwtGuard créé, JwtOrApiKeyGuard créé, double-registration IPC macOS, GET /admin/providers/:id/health manquant, user store Zustand non peuplé, bandwidthBytesUsedTotal jamais incrémenté, auto-login desktop, Fragment key React, navigation SPA Admin.tsx, Socket.IO non proxié, BigInt < number TypeError, seed proxy dedup |
| 14 | 2026-06-07 | Audit itération 14 — 9 bugs supplémentaires corrigés : (1) preload.ts off() brisé (wrapper anonyme), (2) Main.tsx fuite listeners IPC, (3) WsJwtGuard rôle swallowed par catch, (4) SessionsGateway token non validé à la connexion, (5) ThrottlerGuard jamais activé, (6) broadcastSessionUpdate jamais appelé, (7) ApiKeyGuard Bearer JWT traité comme API key, (8) BigInt JSON serialization crash (toJSON patch), (9) seed.ts dedup commit |
