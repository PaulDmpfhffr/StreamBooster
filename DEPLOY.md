# StreamBooster — Guide de Déploiement

## Prérequis

- Compte Railway (API + MySQL) ou alternative
- Compte Upstash (Redis)
- Compte Vercel (dashboard web)
- Compte Stripe (clés API + produits)
- Repo GitHub pour les releases desktop

---

## 1. Base de données (Railway MySQL)

```bash
# Créer un projet Railway
railway login
railway init

# Ajouter MySQL
railway add mysql

# Copier DATABASE_URL dans .env
railway variables
```

## 2. Redis (Upstash)

1. Créer une base Redis sur upstash.com (free tier)
2. Copier `REDIS_URL` (format `redis://:password@host:port`)

## 3. API NestJS (Railway)

```bash
# Variables d'environnement à configurer dans Railway :
DATABASE_URL=mysql://...
REDIS_URL=redis://:...
JWT_SECRET=<32+ chars random>
JWT_REFRESH_SECRET=<32+ chars random>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
ENCRYPTION_KEY=<64 hex chars>
CORS_ORIGINS=https://streambooster.io,app://

# Deploy
railway up --dockerfile apps/api/Dockerfile

# Migration base de données
railway run npx prisma migrate deploy
railway run npx ts-node apps/api/prisma/seed.ts
```

## 4. Dashboard Web (Vercel)

```bash
cd apps/web
vercel --prod

# Variables d'environnement Vercel :
VITE_API_URL=https://your-api.railway.app
```

## 5. Stripe — Produits

Créer les 4 produits dans le dashboard Stripe et mettre à jour `STRIPE_PRICE_*` :

| Produit | Variable |
|---|---|
| Starter 10 Go | `STRIPE_PRICE_STARTER` |
| Standard 50 Go | `STRIPE_PRICE_STANDARD` |
| Pro 200 Go | `STRIPE_PRICE_PRO` |
| Unlimited | `STRIPE_PRICE_UNLIMITED` |

Webhook Stripe : `https://your-api.railway.app/api/v1/billing/webhook`
Événements à activer :
- `checkout.session.completed` (achat initial)
- `invoice.payment_succeeded` (renouvellements mensuels abonnement Unlimited)

## 6. App Electron — Build & Distribution

### Certificat de signature

**macOS** : Developer ID Application certificate (Apple Developer Program)
```bash
# Configurer dans electron-builder.json5
"mac": {
  "identity": "Developer ID Application: Your Name (XXXXXXXXXX)"
}
```

**Windows** : Code Signing Certificate (EV recommandé)
```bash
# Variables d'environnement pour electron-builder
WIN_CSC_LINK=path/to/certificate.p12
WIN_CSC_KEY_PASSWORD=your_password
```

### Build

```bash
cd apps/desktop

# Windows
npm run build:win

# macOS  
npm run build:mac

# Output : apps/desktop/release/
```

### GitHub Releases

1. Créer un repo `streambooster/desktop` sur GitHub
2. Créer un Personal Access Token avec scope `repo`
3. Ajouter `GH_TOKEN` dans les variables d'environnement
4. Push un tag pour déclencher le release :

```bash
git tag v0.1.0
git push origin v0.1.0
# electron-builder publie automatiquement sur GitHub Releases
```

### Auto-update

Les clients Electron vérifient automatiquement les mises à jour via `electron-updater`
en pointant sur le repo GitHub configuré dans `electron-builder.json5`.

---

## Checklist sécurité pré-prod

- [ ] JWT_SECRET et JWT_REFRESH_SECRET générés aléatoirement (≥ 32 chars)
- [ ] ENCRYPTION_KEY généré (64 hex chars = 256 bits)
- [ ] STRIPE_WEBHOOK_SECRET configuré (depuis Stripe dashboard)
- [ ] CORS_ORIGINS limité au domaine prod + `app://`
- [ ] Rate limiting activé (ThrottlerModule en place)
- [ ] HTTPS forcé sur Railway/Vercel (automatique)
- [ ] Prisma migrations appliquées (pas migrate dev en prod)
- [ ] Logs audit activés (AuditLogInterceptor sur toutes les routes admin)
