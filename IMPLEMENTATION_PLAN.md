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
| 31 | 2026-06-07 | Webhook Stripe rate-limité — ThrottlerGuard (60 req/min) appliqué globalement y compris au endpoint POST /billing/webhook. En cas de rafale Stripe (rattrapage après panne), les webhooks retournaient 429, causant des pertes de crédits. Fix : @SkipThrottle() sur le handler webhook |
| 32 | 2026-06-07 | Race condition TOCTOU dans sessions.start() — deux requêtes concurrentes pouvaient passer le check de solde avant que l'une décrémente → solde négatif. Fix : updateMany conditionnel atomique (WHERE bandwidthBytesRemaining >= reservedBytes) à l'intérieur de la transaction. Le check optimiste avant la transaction est conservé pour un rejet rapide dans le cas évident. Nouveau test : race condition simulée (updateMany count=0) |
| 33 | 2026-06-07 | Race condition TOCTOU dans finalizeSession() — cron + arrêt manuel simultanés pouvaient double-comptabiliser la consommation. Fix : session.updateMany(WHERE status='active') atomique dans la transaction. Si count=0 → session déjà finalisée → return false → redis.del et broadcastSessionUpdate non exécutés. Nouveau test : finalisation concurrente idempotente |
| 34 | 2026-06-07 | Double-crédit Unlimited à la souscription — Stripe émet checkout.session.completed ET invoice.payment_succeeded lors de la première souscription → 20 To au lieu de 10 To. Fix : skip isSubscription dans le handler checkout.session.completed (tous les crédits subscription passent par invoice.payment_succeeded). Tests billing mis à jour : 2 cas unlimited checkout ignorés, test price ID corrigé. Billing.tsx + Keys.tsx : mutations sans onError → utilisateur sans retour en cas d'erreur |
| 35 | 2026-06-07 | Corrections UI admin — (1) AdminProxies.tsx : deleteProxy sans onError → suppression silencieuse si proxy utilisé par session active (FK MySQL), (2) Admin.tsx : 3 liens dans grid-cols-2 → dernier lien seul sur sa ligne (grid-cols-3) |
| 36 | 2026-06-07 | Desktop Main.tsx : detectPlatformName manquait youtu.be → URLs courtes YouTube envoyaient platform='twitch' à l'API (tandis que l'injecteur Electron utilisait correctement injectYoutube). Aligné avec platformDetector.ts |
| 37 | 2026-06-07 | Validation DTOs manquante sur 5 endpoints — (1) POST /sessions/start : instanceCount non validé → BigInt(NaN) = TypeError 500 ; ajout StartSessionDto, (2) PATCH /admin/users/:id/bandwidth : bytesDelta 0/non-number silencieux ; ajout AdjustBandwidthDto, (3) POST /billing/checkout : successUrl/cancelUrl non validés → erreur Stripe en 500 ; ajout CreateCheckoutDto (@IsUrl), (4) POST /admin/proxies : type enum non validé → Prisma 500 si valeur invalide ; ajout CreateProxyDto (@IsIn), (5) POST /admin/providers : adapterType enum non validé ; ajout CreateProviderDto |
| 38 | 2026-06-07 | formatBytes() crashait sur les valeurs négatives (solde peut aller négatif après dépassement) — Math.log(negative) = NaN → affichage "NaN undefined". Fix : gestion du signe + Math.min pour éviter dépassement d'index array sur valeurs > 1 Po. Corrigé dans web et desktop |
| 39 | 2026-06-07 | Deux erreurs P2002/P2003 Prisma non catchées renvoyaient 500 — (1) auth.service.ts register() : race condition deux inscriptions simultanées même email → P2002 unique constraint → 500 au lieu de 409 ConflictException ; (2) proxies.service.ts deleteProxy() : suppression d'un proxy utilisé par une session active → P2003 foreign key constraint → 500 au lieu de 409 ConflictException avec message explicite |
| 40 | 2026-06-07 | (1) Desktop Main.tsx : session API créée (bandwidth débité) mais sessionStart Electron échoue → session orpheline jamais stoppée manuellement, expire en 90s. Fix : appel apiSessionStop() dans le catch si apiSessionId défini. (2) AdminUsers.tsx : bytesDelta=0 contournait la validation côté client (serveur retournait 400 avec onError silencieux) ; ajout go===0 dans le guard + message d'erreur dans onError |
| 41 | 2026-06-07 | Idempotence webhooks Stripe manquante — Stripe réessaye les webhooks si la réponse HTTP est perdue après que la transaction DB a réussi → double-crédit. Fix : vérification d'idempotence avant chaque crédit en utilisant session.id (checkout) et invoice.id (invoice.payment_succeeded) comme clés (toujours non-null). 2 nouveaux tests d'idempotence. Correction bonus : mock Stripe ts-jest ({default: jest.fn()}) + types $transaction explicites (Prisma.TransactionClient) |
| 42 | 2026-06-07 | Corrections compilation ts-jest — 4 suites de tests ramenées à 0 erreur (37 tests au total) : (1) getRedisToken → getRedisConnectionToken dans auth + sessions specs, (2) $transaction self-référentiel → jest.fn() + mockImplementation dans beforeEach, (3) jest.fn() sans annotation TypeScript pour éviter erreurs d'inférence, (4) UseGuards importé depuis @nestjs/websockets (n'existe pas) → @nestjs/common dans sessions.gateway.ts |
| 43 | 2026-06-07 | Desktop sessionManager.ts : leak de contextes Playwright si la création échoue à mi-boucle (proxy unreachable, goto timeout) — les contextes déjà créés avant l'erreur ne sont jamais fermés. Fix : try-catch autour de la boucle de création, cleanup de tous les contextes partiellement créés avant de propager l'erreur |
| 44 | 2026-06-07 | api-keys.controller.ts : POST /keys acceptait un libellé de taille illimitée (@Body('label') sans DTO) → stockage illimité en base. Ajout CreateApiKeyDto avec @IsOptional @IsString @MaxLength(100). La migration vers @Body() dto améliore aussi la cohérence avec ValidationPipe global |
| 45 | 2026-06-07 | (1) billing.service.ts createCheckout() : race condition sur la création du client Stripe — deux requêtes simultanées avec stripeCustomerId null créaient chacune un client Stripe ; la deuxième mise à jour écrasait la première → client orphelin dans Stripe. Fix : updateMany(WHERE stripeCustomerId IS NULL) atomique ; si count=0, relecture du stripeCustomerId sauvé par l'autre requête. (2) admin.controller.ts adjustBandwidth : userId inexistant → Prisma P2025 non catchée → 500 au lieu de 404. Fix : findUnique + NotFoundException avant la transaction (+ import NotFoundException ajouté) |
| 46 | 2026-06-07 | Desktop injecteurs : addInitScript() appelé APRÈS goto() dans tous les injecteurs (twitch, youtube, kick, tiktok) — Playwright n'exécute addInitScript que pour la navigation suivante, jamais pour la page déjà chargée. navigator.webdriver n'était donc jamais masqué lors du chargement initial → plateformes pouvaient détecter le bot. Fix : déplacement de addInitScript() dans sessionManager.ts, avant goto() ; suppression des appels redondants dans les 4 injecteurs |
| 47 | 2026-06-07 | auth.service.ts refresh() : race condition sur la blacklist Redis — exists() puis set() non-atomique → deux requêtes de refresh simultanées avec le même token passaient toutes les deux le check exists() avant que l'une écrive → double émission de tokens avec un seul refresh token (replay attack possible en cas de réseau instable). Fix : remplacement de exists()+set() par set(key, '1', 'EX', TTL, 'NX') atomique — retourne 'OK' si le token n'était pas blacklisté (succès), null sinon (rejet). Test mis à jour : mockRedis.exists supprimé, set.mockResolvedValue(null) pour simuler le blacklist |
| 48 | 2026-06-07 | sessions.service.ts stop() : non-idempotent — si la session avait expiré par le cron entre l'affichage et le clic "Arrêter", findFirst(WHERE status='active') retournait null → NotFoundException 404. Desktop stopSession() a un try/finally sans catch → l'erreur 404 propagée causait une rejection non gérée. Fix : findFirst sans filtre status + check explicite status !== 'active' → { ok: true } immédiat (idempotence). Ajout de 2 tests stop() : session introuvable (NotFoundException) + session déjà terminée (idempotence, $transaction non appelé) |
| 49 | 2026-06-07 | sessions.service.ts expireDeadSessions() : boucle for-await sans try-catch — si finalizeSession() lançait une exception sur une session (timeout DB, deadlock), toutes les sessions suivantes dans le batch étaient ignorées. Un seul incident bloquait l'ensemble des expirations de la même itération du cron. Fix : .catch() isolé par session + Logger.error() pour diagnostique ; les sessions restantes continuent d'être traitées |
| 50 | 2026-06-07 | Couverture de tests manquante pour deleteProxy (fix P2003 itération 39 jamais testé) — ajout de 3 tests : proxy inexistant (NotFoundException), suppression normale, proxy utilisé par session active (ConflictException via P2003). Total : 43 tests, 4 suites. Ajout import ConflictException/NotFoundException dans proxies.service.spec.ts |
| 51 | 2026-06-07 | 3 bugs critiques : (1) reconciliation.service.ts last-write-wins — sessions avec N proxies du même fournisseur : bytesReconciled écrasé N fois, seul le dernier proxy comptait. Fix : accumulation totalRealBytes sur tous les proxies avant un seul update. (2) schema.prisma : BandwidthTransaction.stripePaymentId sans @unique → deux webhooks Stripe simultanés pouvaient double-créditer. Fix : @unique ajouté. (3) billing.service.ts : P2002 non catchée dans les handlers webhook → 500 à Stripe si concurrent gagne la course. Fix : try-catch P2002 dans les deux handlers (checkout + invoice). Test P2002 concurrent ajouté (44 tests total) |
| 52 | 2026-06-07 | 2 bugs desktop : (1) Main.tsx stopSession() : await séquentiel sessionStop→apiSessionStop — si sessionStop échoue, apiSessionStop n'est jamais appelé, session API continue de consommer BP pendant 90s. Fix : Promise.allSettled (les deux s'exécutent indépendamment). (2) sessionManager.ts : parsing URL proxy avec split('@') — password contenant '@' produisait server et credentials incorrects. Fix : lastIndexOf('@') pour credentials + indexOf(':') pour user/password |
| 53 | 2026-06-07 | Sécurité frontend : routes /admin/* derrière AuthLayout qui vérifie uniquement l'authentification, pas le rôle admin. Utilisateur normal pouvait accéder directement à /admin/users etc. (API renvoyait 403 mais page se rendait). Fix : AdminLayout guard qui redirige vers /dashboard si user.role !== 'admin'. Routes admin imbriquées dans <AdminLayout> |
| 54 | 2026-06-07 | Desktop sessions orphelines à l'arrêt : à la fermeture de l'app (app quit), BrowserContext Playwright et Browser restaient actifs (processus Chromium orphelins), session API continuait à déduire BP pendant 90s (TTL heartbeat). Fix : SessionManager.stopAll() arrête toutes sessions actives + ferme le Browser. Handler app.on('before-quit') dans session.ipc.ts |
| 55 | 2026-06-07 | Secrets faibles en production : configuration.ts a des fallbacks JWT_SECRET/JWT_REFRESH_SECRET='dev-secret-change-me' et ENCRYPTION_KEY='0'×64. Si vars non définies en production → tokens falsifiables, adresses proxy déchiffrables. Fix : guard au démarrage bootstrap() qui lance une Error explicite si NODE_ENV=production et qu'une des 6 vars critiques est absente |
| 56 | 2026-06-07 | Desktop heartbeat silencieux : api:session-heartbeat ne vérifiait pas la réponse HTTP. Session expirée par cron → API retourne 404 → client continue d'envoyer des heartbeats, UI reste bloquée sur 'active' indéfiniment. Fix : vérification status 404 → retour { sessionExpired: true } ; renderer réinitialise l'UI et appelle sessionStop() |
| 57 | 2026-06-07 | Type TypeScript apiHeartbeat incorrect : signature déclarée Promise<void> dans Onboarding.tsx mais modifiée à Promise<{ sessionExpired?: boolean } \| undefined> en iter56. Correction du type global |
| 58 | 2026-06-07 | Test expireDeadSessions — isolation erreur : si une session échoue (DB timeout), les sessions suivantes doivent continuer à être traitées. Test vérifie que broadcastSessionUpdate est appelé pour sess-ok malgré l'erreur sur sess-err (46 tests total) |
| 59 | 2026-06-07 | billing.service.ts — invoice.payment_succeeded : line.price peut être un string (price ID non-expansé) ou Stripe.Price objet. Cast (line.price as Stripe.Price \| null)?.id retournait undefined sur string → renouvellement Unlimited non crédité. Fix : typeof price === 'string' ? price : price?.id. Nouveau test string price ID (46 tests passent) |
| 60 | 2026-06-07 | 2 bugs : (1) Keys.tsx — création de clé API : si l'utilisateur clique "Créer" une 2ème fois sans avoir fermé la bannière, newKey est écrasé et la 1ère clé est définitivement perdue (seul le hash est en DB). Fix : masquer le formulaire tant que newKey est affiché. (2) main.ts — guard bootstrap production : STRIPE_PRICE_* absents de la liste required → checkout crée avec fallback price_starter (ID invalide Stripe) → échec silencieux. Fix : 4 vars STRIPE_PRICE_* ajoutées au guard |
| 61 | 2026-06-07 | Test manquant auth.service.ts : P2002 race condition dans register() — findUnique passe (email libre) mais create échoue car un appel concurrent a inséré l'email entre le check et l'insert. Code existant gérait ce cas mais sans test. Nouveau test ajouté (47 tests total) |
| 62 | 2026-06-07 | proxies.service.ts — preferProxyCountry traité comme filtre obligatoire alors que "prefer" implique un repli. Si le pays demandé n'a pas assez de proxys, la session échoue avec BadRequestException. Fix : si le filtre pays retourne moins de proxys que nécessaire, second appel sans filtre (fallback). Test de repli ajouté (48 tests total) |
