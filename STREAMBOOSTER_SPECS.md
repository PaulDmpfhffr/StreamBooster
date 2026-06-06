# StreamBooster — Spécifications & Plan d'Implémentation

## Contexte

StreamBooster est la version SaaS du POC Multi-Viewer Local (MVL) développé dans ce repo.
Ce document consolide les specs fonctionnelles, l'architecture technique et le plan d'implémentation.

---

## 1. Vision & Périmètre

StreamBooster est une plateforme en deux composants :

- **SaaS web** : gestion de compte, achat de bande passante, historique, back-office admin
- **App locale** (Electron) : interface utilisateur pour lancer les sessions de visionnage multi-instances, tourne sur la machine du client

Les sessions Playwright s'exécutent **chez le client** (pas de compute côté serveur).
Le SaaS fournit uniquement les proxys et comptabilise la bande passante consommée.

---

## 2. Architecture Globale

```
┌─────────────────────────────────────────────────────────────┐
│                     Machine utilisateur                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  App Electron                                        │    │
│  │  ┌───────────────┐   ┌──────────────────────────┐  │    │
│  │  │ UI (React)    │   │ Core (Node.js + Playwright│  │    │
│  │  │ localhost:3000│◄──┤ Chromium instances)       │  │    │
│  │  └───────────────┘   └──────────────────────────┘  │    │
│  └─────────────┬───────────────────────────────────────┘    │
└────────────────┼────────────────────────────────────────────┘
                 │ HTTPS (API Key)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                     SaaS (serveur)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  NestJS API  │  │  MySQL       │  │  Redis           │  │
│  │  /api/v1/... │  │  (données)   │  │  (sessions live) │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────┘  │
└─────────┼───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────┐      ┌──────────────────────┐
│  Fournisseurs proxys        │      │  Stripe              │
│  (IPRoyal, Bright Data, ...) │      │  (paiements)         │
│  API : allocation + usage   │      └──────────────────────┘
└─────────────────────────────┘
```

---

## 3. Stack Technique

| Composant | Techno |
|---|---|
| SaaS Frontend | React + Vite + TypeScript + Tailwind + shadcn/ui |
| SaaS API | NestJS + TypeScript |
| BDD | MySQL + Prisma ORM |
| Cache / Sessions live | Redis |
| App locale | Electron + React + Node.js |
| Browser automation | Playwright (Chromium bundled) |
| Paiement | Stripe Checkout + Webhooks |
| Déploiement API | Docker + Railway ou Render |
| Déploiement SaaS front | Vercel |
| Distribution desktop | GitHub Releases (electron-builder) |

---

## 4. Structure du Monorepo

```
streambooster/
├── apps/
│   ├── web/          ← Dashboard SaaS (React + Vite)
│   ├── api/          ← Backend (NestJS)
│   └── desktop/      ← App locale (Electron + React)
├── packages/
│   └── shared/       ← Types TypeScript partagés (DTOs, enums)
└── package.json      ← Monorepo Turborepo
```

### packages/shared

```
shared/src/
├── dto/
│   ├── session.dto.ts
│   ├── proxy.dto.ts
│   └── billing.dto.ts
├── enums/
│   ├── platform.enum.ts        # twitch | youtube | kick | tiktok
│   ├── session-status.enum.ts
│   └── proxy-type.enum.ts
└── index.ts
```

---

## 5. Modèle de Données (MySQL / Prisma)

### users
| Champ | Type | Notes |
|---|---|---|
| id | UUID | PK |
| email | VARCHAR | unique |
| password_hash | VARCHAR | bcrypt |
| role | ENUM | `user`, `admin` |
| bandwidth_bytes_remaining | BIGINT | solde en octets |
| bandwidth_bytes_used_total | BIGINT | cumulatif |
| stripe_customer_id | VARCHAR | nullable |
| created_at | DATETIME | |

### api_keys
| Champ | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users |
| key_hash | VARCHAR | SHA-256, jamais stockée en clair |
| label | VARCHAR | ex: "Mon PC bureau" |
| last_used_at | DATETIME | |
| is_active | BOOLEAN | révocable |
| created_at | DATETIME | |

### proxy_providers
| Champ | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR | ex: `iproyal`, `brightdata` |
| display_name | VARCHAR | ex: "IPRoyal" |
| api_key_encrypted | TEXT | AES-256 |
| api_endpoint | VARCHAR | URL API réconciliation |
| adapter_type | ENUM | `iproyal`, `brightdata`, `webshare`, `manual` |
| is_active | BOOLEAN | |
| priority | INT | ordre de préférence à l'allocation |

### proxy_pool
| Champ | Type | Notes |
|---|---|---|
| id | UUID | PK |
| provider_id | UUID | FK → proxy_providers |
| address_encrypted | VARCHAR | AES-256 |
| country_code | VARCHAR | FR, US, DE... |
| type | ENUM | `residential`, `mobile`, `datacenter` |
| is_active | BOOLEAN | |
| provider_credential_id | VARCHAR | pour réconciliation usage |

### sessions
| Champ | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK |
| api_key_id | UUID | FK |
| platform | ENUM | `twitch`, `youtube`, `kick`, `tiktok` |
| stream_url | VARCHAR | |
| instance_count | INT | |
| status | ENUM | `active`, `ended`, `error` |
| started_at | DATETIME | |
| ended_at | DATETIME | nullable |
| bytes_estimated | BIGINT | calculé à la fin |
| bytes_reconciled | BIGINT | mis à jour par le cron provider |
| last_heartbeat_at | DATETIME | |

### session_proxies
| Champ | Type | Notes |
|---|---|---|
| session_id | UUID | FK |
| proxy_id | UUID | FK |
| instance_index | INT | quel slot (1, 2, 3...) |

### bandwidth_transactions
| Champ | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK |
| type | ENUM | `purchase`, `consumption`, `refund` |
| bytes_delta | BIGINT | positif = crédit, négatif = débit |
| description | VARCHAR | ex: "Pack 50 Go", "Session #abc..." |
| stripe_payment_id | VARCHAR | nullable |
| created_at | DATETIME | |

---

## 6. API NestJS — Endpoints

### Auth
| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | — | Inscription email/password |
| POST | `/api/v1/auth/login` | — | Retourne JWT access + refresh |
| POST | `/api/v1/auth/refresh` | Refresh token | Renouvelle l'access token |

### API Keys
| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/keys` | JWT | Liste les clés de l'utilisateur |
| POST | `/api/v1/keys` | JWT | Crée une clé (retourne le raw UNE fois) |
| DELETE | `/api/v1/keys/:id` | JWT | Révoque une clé |

### Sessions (app desktop)
| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/sessions/start` | API Key | Alloue N proxys, retourne credentials |
| POST | `/api/v1/sessions/:id/heartbeat` | API Key | Signal de vie (toutes les 30s) |
| POST | `/api/v1/sessions/:id/stop` | API Key | Clôture, calcule consommation |
| GET | `/api/v1/sessions` | JWT | Historique des sessions |

**Body `/sessions/start` :**
```json
{
  "platform": "twitch",
  "streamUrl": "https://twitch.tv/xxxx",
  "instanceCount": 4,
  "preferProxyCountry": "FR"
}
```

**Réponse `/sessions/start` :**
```json
{
  "sessionId": "uuid",
  "proxies": [
    { "index": 1, "address": "socks5://user:pass@ip:port" },
    { "index": 2, "address": "socks5://user:pass@ip:port" }
  ],
  "bandwidthReservedBytes": 524288000,
  "bandwidthRemainingBytes": 10737418240
}
```

### Compte
| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/account/me` | JWT ou API Key | Profil + solde bande passante |
| GET | `/api/v1/account/usage` | JWT | Transactions + sessions |

### Billing
| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/billing/products` | — | Liste les packs disponibles |
| POST | `/api/v1/billing/checkout` | JWT | Crée une session Stripe Checkout |
| POST | `/api/v1/billing/webhook` | Stripe HMAC | Webhook Stripe |

### Admin
| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/admin/stats` | JWT Admin | Revenus, Go consommés, users actifs |
| GET/PATCH | `/api/v1/admin/users` | JWT Admin | Liste + ajustement solde manuel |
| GET/POST/PATCH/DELETE | `/api/v1/admin/proxies` | JWT Admin | CRUD pool proxys |
| GET/POST/PATCH/DELETE | `/api/v1/admin/providers` | JWT Admin | CRUD fournisseurs |
| GET | `/api/v1/admin/sessions` | JWT Admin | Sessions actives + historique global |

---

## 7. Structure API NestJS

```
apps/api/src/
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── jwt-refresh.strategy.ts
│   │   └── guards/
│   │       ├── jwt.guard.ts
│   │       ├── api-key.guard.ts
│   │       └── roles.guard.ts
│   ├── users/
│   ├── api-keys/
│   ├── proxies/
│   │   ├── proxies.service.ts
│   │   └── adapters/
│   │       ├── proxy-provider.interface.ts
│   │       ├── iproyal.adapter.ts
│   │       ├── brightdata.adapter.ts
│   │       ├── webshare.adapter.ts
│   │       └── manual.adapter.ts       ← pas de réconciliation réelle
│   ├── sessions/
│   │   ├── sessions.service.ts
│   │   └── sessions.gateway.ts         ← WebSocket statut live (admin)
│   ├── billing/
│   │   ├── billing.service.ts
│   │   └── stripe.webhook.controller.ts
│   └── admin/
├── database/
│   └── prisma/
│       └── schema.prisma
├── common/
│   ├── decorators/
│   ├── interceptors/
│   │   └── audit-log.interceptor.ts
│   └── filters/
└── config/
    └── configuration.ts
```

### Pattern Adapter fournisseurs

```typescript
interface IProxyProviderAdapter {
  getUsageBytes(credentialId: string, from: Date, to: Date): Promise<number>
  isHealthy(): Promise<boolean>
  listAvailableProxies(): Promise<RawProxy[]>
}

// Implémentations
class IPRoyalAdapter    implements IProxyProviderAdapter { ... }
class BrightDataAdapter implements IProxyProviderAdapter { ... }
class WebshareAdapter   implements IProxyProviderAdapter { ... }
class ManualAdapter     implements IProxyProviderAdapter {
  // Usage estimé uniquement — pas de réconciliation réelle
}
```

### Logique d'allocation des proxys

À chaque `/sessions/start` :
1. **Disponibilité** — proxy non assigné à une session active
2. **Priorité fournisseur** — configurée en back-office
3. **Pays préféré** — si `preferProxyCountry` fourni
4. **Distribution** — évite de concentrer toutes les instances sur le même fournisseur

---

## 8. Suivi de Bande Passante

### Bitrates estimés par qualité

| Qualité | Bitrate estimé |
|---|---|
| 160p (Twitch) | 250 Ko/s |
| 360p | 600 Ko/s |
| 480p | 1 200 Ko/s |
| Source / inconnu | 5 000 Ko/s |

### Flux de comptabilisation

```
1. /sessions/start
   → Réservation estimée débitée (instanceCount × 500 Mo)

2. Heartbeats toutes les 30s
   → Maintient la session "active" dans Redis

3. Timeout heartbeat (90s sans signal)
   → Cron expire la session automatiquement
   → Calcule consommation finale

4. /sessions/stop
   → Calcul : durée_minutes × instanceCount × bitrate_qualité
   → Ajustement débit vs réservation initiale

5. Cron réconciliation toutes les 4h
   → Query API fournisseur : octets réels par credential
   → Update sessions.bytes_reconciled
   → Ajustement si écart > 10%
```

---

## 9. Packs de Bande Passante (Stripe)

| Pack | Go | Prix | Prix/Go |
|---|---|---|---|
| Starter | 10 Go | 4,99 € | 0,50 €/Go |
| Standard | 50 Go | 19,99 € | 0,40 €/Go |
| Pro | 200 Go | 59,99 € | 0,30 €/Go |
| Unlimited | ∞ | 99,99 €/mois | — |

---

## 10. Structure App Electron

```
apps/desktop/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── ipc/
│   │   ├── session.ipc.ts
│   │   └── api.ipc.ts
│   └── core/
│       ├── sessionManager.ts    ← adapté depuis le POC MVL
│       ├── twitchInjector.ts    ← repris depuis le POC MVL
│       ├── youtubeInjector.ts
│       ├── kickInjector.ts
│       ├── tiktokInjector.ts
│       └── platformDetector.ts
├── renderer/
│   └── src/
│       ├── pages/
│       │   ├── Onboarding.tsx   ← saisie clé API + validation
│       │   └── Main.tsx
│       └── components/
│           ├── SessionGrid.tsx
│           ├── ScreenshotGrid.tsx
│           ├── BandwidthBar.tsx
│           └── ProxyList.tsx    ← lecture seule (proxys assignés par le SaaS)
└── package.json
```

### Flux IPC Main ↔ Renderer

```
Renderer (React)             Main process (Node.js)
       │                             │
       │  ipc: 'session:start'       │
       │ ───────────────────────────>│
       │  { apiKey, url,             │── POST /api/v1/sessions/start
       │    instanceCount, ... }     │   ← { sessionId, proxies[] }
       │                             │── Lance N Playwright contexts
       │  ipc: 'session:started'     │
       │<────────────────────────────│
       │                             │
       │  ipc: 'screenshot:update'   │  (toutes les Xs)
       │<────────────────────────────│
       │                             │
       │  ipc: 'session:stop'        │
       │ ───────────────────────────>│── POST /api/v1/sessions/:id/stop
       │                             │── Ferme tous les contextes
```

### Onboarding (premier lancement)

1. Écran avec champ "Clé API StreamBooster"
2. Appel `GET /api/v1/account/me` pour valider
3. Stockage via `safeStorage.encryptString()` dans `userData` Electron
4. Affichage du dashboard principal avec solde

### Adaptation depuis le POC MVL

| POC MVL | App StreamBooster |
|---|---|
| Proxys saisis manuellement | Proxys reçus depuis `/sessions/start` |
| `config.json` local | `electron-store` + `safeStorage` |
| `node server.js` | Process Electron principal |
| `fetch('/api/...')` | IPC vers main process |
| Heartbeat absent | `setInterval` heartbeat 30s |
| Twitch uniquement | Multi-plateforme via `platformDetector` |

### Scripts injectés par plateforme

| Plateforme | Consent banner | Gate âge/contenu | Force qualité | Viewer count |
|---|---|---|---|---|
| **Twitch** | ✅ `consent-banner-accept` | ✅ `content-classification-gate-overlay-start-watching-button` | ✅ API React player | ✅ `animated-channel-viewers-count` |
| **YouTube** | À implémenter | À implémenter | ✅ via `yt-player` API | ✅ `.view-count` |
| **Kick** | À implémenter | N/A | ✅ HLS similaire Twitch | ✅ `.viewers-count` |
| **TikTok Live** | À implémenter | N/A | Limité | ✅ `.viewer-count-text` |

### Build & distribution

```json
{
  "appId": "io.streambooster.desktop",
  "productName": "StreamBooster",
  "publish": { "provider": "github" },
  "win":   { "target": "nsis" },
  "mac":   { "target": "dmg" },
  "linux": { "target": "AppImage" }
}
```

Auto-update via `electron-updater` → GitHub Releases.

---

## 11. Dashboard SaaS — Pages V1

| Page | Accès | Contenu |
|---|---|---|
| `/` | Public | Landing page : features, pricing, CTA |
| `/register` | Public | Inscription |
| `/login` | Public | Connexion |
| `/dashboard` | Auth | Solde BP, sessions actives, dernières transactions |
| `/keys` | Auth | Liste des clés API, créer/révoquer |
| `/billing` | Auth | Packs disponibles, historique achats |
| `/usage` | Auth | Graphique conso, historique sessions |
| `/admin` | Admin | Tableau de bord global |
| `/admin/users` | Admin | Liste utilisateurs, ajustements manuels |
| `/admin/proxies` | Admin | CRUD pool proxys |
| `/admin/providers` | Admin | CRUD fournisseurs + test connectivité |
| `/admin/sessions` | Admin | Sessions actives en temps réel (WebSocket) |

---

## 12. Sécurité

- **API Keys** : jamais stockées en clair (SHA-256), transmises une seule fois
- **Proxys** : adresses chiffrées AES-256 au repos, déchiffrées uniquement à l'allocation
- **JWT** : access token 15 min, refresh token 7 jours, rotation à chaque refresh
- **Rate limiting** : Redis via `nestjs-throttler` — 60 req/min par IP, 300/min par API key
- **Stripe webhooks** : vérification signature HMAC systématique
- **CORS** : origines whitelistées (domaine SaaS + `app://` Electron)
- **Audit log** : toutes les actions admin tracées via interceptor

---

## 13. Infrastructure & Déploiement

```
API NestJS   → Railway (Docker) ou Render
MySQL        → PlanetScale ou Railway MySQL
Redis        → Upstash (free tier suffisant en V1)
Web React    → Vercel
Desktop      → GitHub Releases (signé electron-builder)
```

### Variables d'environnement API

```env
DATABASE_URL=mysql://...
REDIS_URL=redis://...
JWT_SECRET=
JWT_REFRESH_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
ENCRYPTION_KEY=                 # AES-256 pour proxys
CORS_ORIGINS=https://streambooster.io,app://
```

---

## 14. Plan d'Implémentation — Jalons

### Phase 0 — Fondations (Jour 1-2)
- [ ] Init monorepo Turborepo
- [ ] Setup `packages/shared` (DTOs, enums)
- [ ] `docker-compose.yml` (MySQL + Redis)
- [ ] Prisma schema complet + première migration

### Phase 1 — API NestJS (Semaine 1)
- [ ] Module Auth (register, login, refresh, guards)
- [ ] Module API Keys (CRUD + guard)
- [ ] Module Proxies (CRUD admin + adapters + logique d'allocation)
- [ ] Module Sessions (start, heartbeat, stop, cron timeout)
- [ ] Module Billing (products, Stripe Checkout, webhook)
- [ ] Module Admin (stats, users, proxies, sessions)

### Phase 2 — Dashboard SaaS React (Semaine 2)
- [ ] Setup Vite + React + Tailwind + shadcn/ui + React Query + Zustand
- [ ] Pages Auth (login, register)
- [ ] Dashboard principal (solde, résumé)
- [ ] Page API Keys
- [ ] Page Billing (packs + Stripe redirect)
- [ ] Page Usage (graphiques)
- [ ] Pages Admin (users, proxies, providers, sessions live)

### Phase 3 — App Electron (Semaine 3)
- [ ] Setup Electron + React renderer + IPC bridge
- [ ] Onboarding (saisie + validation clé API)
- [ ] Reprise et adaptation du POC MVL (sessionManager, injectors)
- [ ] Intégration API (start/stop session, heartbeat)
- [ ] BandwidthBar (solde + conso en cours)
- [ ] platformDetector + injectors YouTube, Kick, TikTok
- [ ] electron-builder + electron-updater

### Phase 4 — Tests & Déploiement (Semaine 4)
- [ ] Tests unitaires API (Jest) — auth, billing, allocation proxys
- [ ] Tests e2e API (Supertest) — routes critiques
- [ ] Checklist sécurité complète
- [ ] Déploiement Railway + Vercel
- [ ] Build Electron signé (Windows + Mac + Linux)
- [ ] GitHub Releases + auto-update

---

## 15. Référence POC MVL

Le POC développé dans ce repo (`TwitchMultiSessions/`) contient les implémentations
de référence à porter dans l'app Electron :

| Fichier POC | Rôle | Statut pour StreamBooster |
|---|---|---|
| `src/sessionManager.js` | Gestion des contextes Playwright | À porter en TypeScript, proxys injectés par API |
| `src/twitchInjector.js` | Scripts injectés Twitch (160p, mute, consent, gate) | À porter tel quel |
| `src/configStore.js` | Persistance config locale | Remplacé par electron-store + safeStorage |
| `server.js` | Serveur Express + routes API | Remplacé par IPC Electron + appels SaaS |
| `public/` | Dashboard HTML/CSS/JS | Remplacé par React renderer Electron |
