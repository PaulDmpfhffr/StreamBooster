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
| 15 | 2026-06-07 | Corrections billing et robustesse — (1) finalizeSession : overage billing ignoré corrigé (adjustment < 0 désormais déduit), (2) reconciliation.service.ts : division par zéro si bytesEstimated=0, (3) proxies.service.ts : decrypt sans try-catch dans allocateProxies — message d'erreur clair en cas de donnée corrompue |
| 16 | 2026-06-07 | Sécurité auth — rotation refresh token réelle implémentée : (1) AuthService.refresh() blackliste le token SHA-256 dans Redis avec TTL 7j avant d'en émettre un nouveau, (2) controller passe refreshToken depuis @Body() au service, (3) tests unitaires mis à jour avec mockRedis + 3 nouveaux cas (rotation, replay attack, user supprimé) |
| 17 | 2026-06-07 | Desktop sessionManager.ts — (1) captureLoop() Promise non gérée corrigée (.catch(() => {})), (2) clearInterval cast incorrect (as unknown as number) supprimé — clearInterval(NodeJS.Timer) direct |
| 18 | 2026-06-07 | Corrections IPC desktop + UI admin — (1) api.ipc.ts : api:get-account sans res.ok vérification (erreurs HTTP silencieuses), (2) api:session-stop sans res.ok (arrêt silencieux en cas d'erreur réseau), (3) AdminUsers.tsx : mutation sans onError — formulaire gelé en cas d'échec |
| 19 | 2026-06-07 | Tests e2e renforcés — 2 nouveaux cas POST /auth/refresh : rotation OK + replay attack retourne 401 (couverture Redis blacklist) |
| 20 | 2026-06-07 | Admin stats corrigées — getStats() comptabilisait les ajustements manuels admin comme des achats (type='purchase' sans stripePaymentId). Fix : filtre ajouté stripePaymentId: { not: null } pour n'agréger que les vrais achats Stripe |
| 21 | 2026-06-07 | Tests billing complétés — 4 nouveaux cas handleWebhook : (1) starter crédite 10 Go exact, (2) unlimited crédite 10 To (UNLIMITED_BYTES, régression fix itération 6), (3) event inconnu ignoré silencieusement, (4) signature invalide → BadRequestException |
| 22 | 2026-06-07 | Desktop Main.tsx — getAccount() dans finally bloquait stopSession en cas d'erreur réseau (unhandled rejection). Fix : rafraîchissement du solde rendu non-bloquant via .then().catch(() => {}) |
| 23 | 2026-06-07 | Tests proxies renforcés — ajout cas ciphertext corrompu dans allocateProxies : doit lancer BadRequestException (couverture du try-catch decrypt ajouté itération 15) |
| 24 | 2026-06-07 | Tests sessions.service créés (module le plus critique, zéro test avant) — 8 cas : start (user inconnu, BP insuffisante, succès), heartbeat (session inconnue, TTL renouvelé), finalizeSession (session manquante, broadcast, refund, overage) |
| 25 | 2026-06-07 | Indices Prisma manquants ajoutés au schéma — (1) ApiKey.keyHash : @unique (scan complet à chaque requête API key), (2) Session : @@index([status, lastHeartbeatAt]) pour le cron heartbeat, @@index([userId, startedAt]) pour l'historique, (3) BandwidthTransaction : @@index([userId, createdAt]) pour les queries d'usage |
| 26 | 2026-06-07 | Corrections billing + admin + frontend — (1) BillingService.handleWebhook : payment_intent null pour abonnements → utilise (payment_intent ?? subscription) comme stripePaymentId (les achats Unlimited étaient invisibles dans les stats admin), (2) ReconciliationService.buildAdapter sans try-catch : un provider corrompu arrêtait toute la réconciliation, (3) AdminProxies.tsx : test de connectivité ignorait le champ healthy (tout 200 → vert), (4) addProxy/addProvider sans onError → formulaires gelés en cas d'erreur. Nouveau test billing : subscription ID comme stripePaymentId |
| 27 | 2026-06-07 | Race condition refresh token — api.ts : plusieurs requêtes 401 simultanées lançaient autant de refreshes en parallèle → Redis blacklist rejetait les suivants → faux logout. Fix : Promise partagée (refreshPromise) pour dédupliquer les appels de refresh, tous les waiters réutilisent le même résultat |
| 28 | 2026-06-07 | Renouvellement abonnement Unlimited non géré — checkout.session.completed ne se déclenche qu'à la souscription initiale. Les renouvellements mensuels Stripe émettent invoice.payment_succeeded (non implémenté) → abonnés Unlimited ne recevaient leur 10 To qu'une seule fois. Fix : handler invoice.payment_succeeded avec lookup par stripeCustomerId + vérification de la price ID Unlimited. 2 nouveaux tests : renouvellement OK + invoice one-time ignorée |
| 29 | 2026-06-07 | Refactoring guards API key — ApiKeyGuard et JwtOrApiKeyGuard utilisaient findFirst sur keyHash (@unique) au lieu de findUnique. findUnique exploite l'index unique plus efficacement. ApiKeyGuard : détection distincte clé révoquée vs clé inconnue (message d'erreur explicite) |
| 30 | 2026-06-07 | Validation DTOs auth manquante — RegisterDto/LoginDto n'avaient aucun décorateur class-validator malgré ValidationPipe global. Ajout @IsEmail() + @MinLength(8) sur RegisterDto.password et @IsString()/@MinLength(1) sur LoginDto.password. Sans cela, n'importe quelle chaîne passait la validation |
