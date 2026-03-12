import * as Joi from 'joi';

export const JoiValidationSchema = Joi.object({
  EMAIL_USER: Joi.string().email().required(),
  EMAIL_PASSWORD: Joi.string().required(),
  EMAIL_HOST: Joi.string().required(),
  EMAIL_PORT: Joi.number().required(),
  EMAIL_SECURE: Joi.boolean().required(),
  ALLOWED_ORIGIN: Joi.string().required(),
  PORT: Joi.number().default(3000),
  REDIS_URL: Joi.string().required(),
  THROTTLE_TTL: Joi.number().default(86400000), // 24 hours in milliseconds
  THROTTLE_LIMIT: Joi.number().default(100), // Max 100 requests per day per IP
  NO_REPLY_EMAIL: Joi.string().email().required(),
});
