import { HttpException, Injectable } from '@nestjs/common';

const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? 'http://localhost:9099';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM ?? 'mock-platform';

@Injectable()
export class KeycloakAdminService {
  private cachedToken: { value: string; expiresAt: number } | null = null;

  private async getServiceAccountToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.value;
    }

    const res = await fetch(`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.KEYCLOAK_ADMIN_CLIENT_ID!,
        client_secret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET!,
      }),
    });

    if (!res.ok) throw new HttpException("Échec de l'authentification, veuillez réessayer plus tard", res.status);

    const data = await res.json();
    this.cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 10) * 1000 };
    return this.cachedToken.value;
  }

  async updateProfile(keycloakId: string, data: { firstName?: string; lastName?: string; username?: string; email?: string }) {
    const token = await this.getServiceAccountToken();
    const res = await fetch(`${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${keycloakId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new HttpException(await this.formatAdminApiError('mise à jour du profil', res), res.status);
    }
  }

  async changePassword(keycloakId: string, newPassword: string) {
    const token = await this.getServiceAccountToken();
    const res = await fetch(`${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${keycloakId}/reset-password`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'password', value: newPassword, temporary: false }),
    });
    if (!res.ok) {
      throw new HttpException(await this.formatAdminApiError('changement de mot de passe', res), res.status);
    }
  }

  private async formatAdminApiError(action: string, res: Response): Promise<string> {
    const body = await res.text().catch(() => '');
    let errorCode = '';
    let field = '';
    try {
      const parsed = JSON.parse(body);
      errorCode = parsed.errorMessage ?? parsed.error ?? '';
      field = parsed.field ?? '';
    } catch {
      // réponse non-JSON, on ignore le corps
    }

    const message = this.translateError(errorCode, field, res.status);
    return `Échec de ${action} : ${message}`;
  }

  private translateError(errorCode: string, field: string, status: number): string {
    if (errorCode === 'error-user-attribute-read-only' || /user name is missing/i.test(errorCode)) {
      return field
        ? `le champ "${field}" est requis ou non modifiable`
        : "le nom d'utilisateur est requis";
    }
    if (status === 403) {
      return "vous n'avez pas les droits nécessaires pour effectuer cette action";
    }
    if (status === 409) {
      return 'cette valeur est déjà utilisée par un autre compte';
    }
    if (status === 404) {
      return 'utilisateur introuvable';
    }
    return errorCode || 'une erreur est survenue, veuillez réessayer';
  }
}
