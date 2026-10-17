import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import basicAuth from 'express-basic-auth';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const config = app.get(ConfigService);

  app.set('trust proxy', 1);
  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { limit: '10mb', extended: true });

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({
    origin: true,
    credentials: true,
    exposedHeaders: 'Content-Disposition',
  });

  // Swagger (bảo vệ bằng basic auth nếu có cấu hình)
  const swaggerUser = config.get<string>('SWAGGER_USERNAME');
  const swaggerPass = config.get<string>('SWAGGER_PASSWORD');
  if (swaggerUser && swaggerPass) {
    app.use(
      ['/docs', '/docs-json'],
      basicAuth({ challenge: true, users: { [swaggerUser]: swaggerPass } }),
    );
  }
  const swaggerConfig = new DocumentBuilder()
    .setTitle('IT Asset Management API')
    .setDescription(
      'Hệ thống quản lý vòng đời tài sản CNTT và bảo trì máy tính cho tổ chức',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
    { swaggerOptions: { persistAuthorization: true } },
  );

  const port = config.get<number>('PORT', 5000);
  await app.listen(port);
  Logger.log(`Server: http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`API Docs: http://localhost:${port}/docs`, 'Bootstrap');
}
bootstrap();
