export const EnvConfiguration = () => ({
  emailUser: process.env.EMAIL_USER,
  emailPassword: process.env.EMAIL_PASSWORD,
  emailHost: process.env.EMAIL_HOST,
  emailPort: process.env.EMAIL_PORT,
  emailSecure: process.env.EMAIL_SECURE,
  allowedOrigin: process.env.ALLOWED_ORIGIN,
  redisUrl: process.env.REDIS_URL,
  throttleTtl: process.env.THROTTLE_TTL,
  throttleLimit: process.env.THROTTLE_LIMIT,
  noReplyEmail: process.env.NO_REPLY_EMAIL,
});
