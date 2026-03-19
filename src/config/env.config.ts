export const EnvConfiguration = () => ({
  emailUser: process.env.EMAIL_USER,
  emailPassword: process.env.EMAIL_PASSWORD,
  emailHost: process.env.EMAIL_HOST,
  emailPort: process.env.EMAIL_PORT,
  emailSecure: process.env.EMAIL_SECURE,
  allowedOrigins: process.env.ALLOWED_ORIGINS,
  redisUrl: process.env.REDIS_URL,
  throttleTtl: process.env.THROTTLE_TTL,
  throttleLimit: process.env.THROTTLE_LIMIT,
  environment: process.env.NODE_ENV,
  contactEmail: process.env.CONTAC_EMAIL,
});
