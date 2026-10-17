import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(5000),
  MONGO_URI: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  SWAGGER_USERNAME: Joi.string().allow('').optional(),
  SWAGGER_PASSWORD: Joi.string().allow('').optional(),

  CLOUDINARY_CLOUD_NAME: Joi.string().allow('').optional(),
  CLOUDINARY_API_KEY: Joi.string().allow('').optional(),
  CLOUDINARY_API_SECRET: Joi.string().allow('').optional(),

  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
  CRON_TIMEZONE: Joi.string().default('Asia/Ho_Chi_Minh'),

  SEED_ADMIN_PASSWORD: Joi.string().default('Admin@123'),
});
