import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';
import { PrismaService } from '../prisma/prisma.service';

const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? 'http://localhost:9099';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM ?? 'mock-platform';

@Injectable()
export class KeycloakJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: (req: any) => {
        const auth = req.headers?.authorization;
        return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
      },
    
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`,
      }),
      issuer: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    const keycloakId: string = payload.sub;
    const email: string = payload.email;

    let user = await this.prisma.user.findUnique({ where: { keycloakId } });

    if (!user && email) {
      user = await this.prisma.user.upsert({
        where: { email },
        update: { keycloakId },
        create: { email, keycloakId, name: payload.preferred_username ?? email },
      });
    }

    if (!user) {
      throw new Error('Utilisateur Keycloak non résolu localement.');
    }

    return { id: user.id, email: user.email, keycloakId: user.keycloakId };
  }
}
