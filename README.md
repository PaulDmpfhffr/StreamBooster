# StreamBooster

Plateforme SaaS de boost de streams multi-viewers.

## Architecture

```
streambooster/
├── apps/
│   ├── web/          ← Dashboard SaaS (React + Vite + Tailwind)
│   ├── api/          ← Backend (NestJS + Prisma + MySQL + Redis)
│   └── desktop/      ← App locale (Electron + Playwright)
└── packages/
    └── shared/       ← Types TypeScript partagés (DTOs, enums)
```

## Démarrage rapide

### Prérequis

- Node.js ≥ 20
- Docker (pour MySQL + Redis)

### Installation

```bash
# Cloner le repo
git clone ...
cd streambooster

# Copier les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# Installer les dépendances
npm install

# Démarrer MySQL + Redis
docker-compose up -d

# Initialiser la base de données
cd apps/api
npm run prisma:migrate
npx ts-node prisma/seed.ts
cd ../..
```

### Développement

```bash
# Démarrer l'API + le dashboard en parallèle
npm run dev

# Ou séparément :
cd apps/api && npm run dev      # → localhost:3001
cd apps/web && npm run dev      # → localhost:5173
cd apps/desktop && npm run dev  # → App Electron
```

### Comptes de test (après seed)

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | admin@streambooster.io | admin123 |
| User | demo@streambooster.io | user123 |
| API Key demo | `sb_demo_key_000000000000000000000000000000` | — |

## Tests

```bash
# Tests unitaires
cd apps/api && npm test

# Tests e2e (requiert DB démarrée)
cd apps/api && npm run test:e2e
```

## Déploiement

Voir [DEPLOY.md](./DEPLOY.md) pour le guide complet Railway + Vercel + Electron.

## Stack technique

| Composant | Techno |
|---|---|
| API | NestJS + TypeScript + Prisma |
| Base de données | MySQL 8 |
| Cache / Sessions | Redis 7 |
| Dashboard web | React + Vite + Tailwind + React Query |
| App desktop | Electron + Playwright (Chromium) |
| Paiement | Stripe Checkout + Webhooks |
| Auth | JWT (access 15min + refresh 7j) |
| Sécurité | AES-256 (proxys), SHA-256 (API keys), bcrypt (mots de passe) |
