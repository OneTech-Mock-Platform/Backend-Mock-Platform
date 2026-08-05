import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { KeycloakJwtStrategy } from './keycloak-jwt.strategy';
import { KeycloakAdminService } from './keycloak-admin.service';
import { ProfileController } from './profile.controller';

// import { JwtModule } from '@nestjs/jwt';
// import { AuthController } from './auth.controller.js';
// import { AuthService } from './auth.service.js';
// import { EmailService } from './email.service.js';
// import { JwtStrategy } from './jwt.strategy.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // JwtModule.register({ secret: process.env.JWT_SECRET || 'onetech_secret_key_2026' }),
  ],
  controllers: [ProfileController],
  // controllers: [AuthController],
  providers: [
    KeycloakJwtStrategy,
    KeycloakAdminService,
    // AuthService, EmailService, JwtStrategy,
  ],
  exports: [KeycloakJwtStrategy],
})
export class AuthModule {}
