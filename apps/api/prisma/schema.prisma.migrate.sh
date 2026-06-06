#!/bin/bash
# Script d'initialisation base de données StreamBooster
# Usage: ./prisma.migrate.sh

set -e

echo "📦 Génération du client Prisma..."
npx prisma generate

echo "🗄️  Application des migrations..."
npx prisma migrate dev --name init

echo "🌱 Seed de la base de données..."
npx ts-node prisma/seed.ts

echo "✅ Base de données prête!"
