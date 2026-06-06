export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
    priceIds: {
      starter: process.env.STRIPE_PRICE_STARTER ?? 'price_starter',
      standard: process.env.STRIPE_PRICE_STANDARD ?? 'price_standard',
      pro: process.env.STRIPE_PRICE_PRO ?? 'price_pro',
      unlimited: process.env.STRIPE_PRICE_UNLIMITED ?? 'price_unlimited',
    },
  },
  encryptionKey: process.env.ENCRYPTION_KEY ?? '0'.repeat(64),
  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
  },
});
