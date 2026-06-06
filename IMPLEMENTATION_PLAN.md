# StreamBooster — Plan d'Implémentation Ralph Loop

> Ce fichier est le point de contrôle du Ralph Loop.
> À chaque itération, Claude lit ce fichier, coche ce qui est fait et avance sur la prochaine tâche.

## Progression globale

- [x] Plan d'implémentation créé
- [x] Phase 0 — Fondations
- [~] Phase 1 — API NestJS (modules auth/keys/proxies/sessions/billing/admin créés)
- [ ] Phase 2 — Dashboard SaaS React
- [ ] Phase 3 — App Electron
- [ ] Phase 4 — Tests & Déploiement

---

## Phase 0 — Fondations (Jour 1-2)

- [x] **P0.1** Init monorepo Turborepo (`package.json` racine, `turbo.json`, `.gitignore`)
- [x] **P0.2** Structure dossiers (`apps/web`, `apps/api`, `apps/desktop`, `packages/shared`)
- [x] **P0.3** `packages/shared` — enums (platform, session-status, proxy-type)
- [x] **P0.4** `packages/shared` — DTOs (session, proxy, billing)
- [x] **P0.5** `docker-compose.yml` (MySQL 8 + Redis 7)
- [x] **P0.6** `apps/api` — init NestJS + Prisma structure
- [x] **P0.7** Prisma schema complet (users, api_keys, proxy_providers, proxy_pool, sessions, session_proxies, bandwidth_transactions)
- [ ] **P0.8** Première migration Prisma + seed de base
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
- [ ] **P1.28** Cron réconciliation fournisseurs (toutes les 4h)
- [x] **P1.29** Rate limiting (nestjs-throttler)
- [x] **P1.30** Audit log interceptor (actions admin)

---

## Phase 2 — Dashboard SaaS React (Semaine 2)

- [ ] **P2.1** Setup Vite + React + TypeScript + Tailwind + shadcn/ui
- [ ] **P2.2** Setup React Query + Zustand + React Router
- [ ] **P2.3** Layout principal (sidebar, header, auth context)
- [ ] **P2.4** Pages auth — /register + /login
- [ ] **P2.5** Page / — Landing (features, pricing, CTA)
- [ ] **P2.6** Page /dashboard — Solde BP + sessions actives + transactions récentes
- [ ] **P2.7** Page /keys — Liste + créer + révoquer clés API
- [ ] **P2.8** Page /billing — Packs + Stripe redirect + historique achats
- [ ] **P2.9** Page /usage — Graphique conso (Recharts) + historique sessions
- [ ] **P2.10** Page /admin — Stats globales
- [ ] **P2.11** Page /admin/users — Liste + ajustements solde
- [ ] **P2.12** Page /admin/proxies — CRUD pool + providers + test connectivité
- [ ] **P2.13** Page /admin/sessions — Sessions actives WebSocket temps réel

---

## Phase 3 — App Electron (Semaine 3)

- [ ] **P3.1** Setup Electron + Vite renderer + TypeScript
- [ ] **P3.2** Preload script (contextBridge IPC)
- [ ] **P3.3** Page Onboarding (saisie API key + validation + safeStorage)
- [ ] **P3.4** IPC bridge session.ipc.ts + api.ipc.ts
- [ ] **P3.5** Port sessionManager.ts depuis POC MVL (proxys injectés via API)
- [ ] **P3.6** Port twitchInjector.ts depuis POC MVL
- [ ] **P3.7** youtubeInjector.ts (consent + qualité + viewer count)
- [ ] **P3.8** kickInjector.ts
- [ ] **P3.9** tiktokInjector.ts
- [ ] **P3.10** platformDetector.ts
- [ ] **P3.11** Page Main.tsx (SessionGrid + ScreenshotGrid)
- [ ] **P3.12** BandwidthBar (solde + conso en cours)
- [ ] **P3.13** Heartbeat 30s automatique
- [ ] **P3.14** electron-builder config (win/mac/linux)
- [ ] **P3.15** electron-updater (GitHub Releases auto-update)

---

## Phase 4 — Tests & Déploiement (Semaine 4)

- [ ] **P4.1** Tests unitaires auth service
- [ ] **P4.2** Tests unitaires billing service (Stripe mock)
- [ ] **P4.3** Tests unitaires allocation proxys
- [ ] **P4.4** Tests e2e routes critiques (Supertest)
- [ ] **P4.5** Checklist sécurité (CORS, rate limit, HMAC, AES, JWT rotation)
- [ ] **P4.6** Dockerfile API optimisé
- [ ] **P4.7** Deploy Railway (API) + PlanetScale (MySQL) + Upstash (Redis)
- [ ] **P4.8** Deploy Vercel (web)
- [ ] **P4.9** Build Electron signé Windows + Mac
- [ ] **P4.10** GitHub Releases + test auto-update

---

## Journal des itérations

| Itération | Date | Actions réalisées |
|---|---|---|
| 1 | 2026-06-07 | Création du plan d'implémentation |
| 2 | 2026-06-07 | Phase 0 complète + Phase 1 API NestJS (tous modules créés : auth, api-keys, proxies/adapters, sessions, billing, admin, account) |
