import { Injectable } from '@nestjs/common';

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

    if (!res.ok) throw new Error(`Échec d'authentification du client de service Keycloak (${res.status})`);

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
    if (!res.ok) throw new Error(await this.formatAdminApiError('mise à jour du profil Keycloak', res));
  }

  async changePassword(keycloakId: string, newPassword: string) {
    const token = await this.getServiceAccountToken();
    const res = await fetch(`${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${keycloakId}/reset-password`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'password', value: newPassword, temporary: false }),
    });
    if (!res.ok) throw new Error(await this.formatAdminApiError('changement de mot de passe', res));
  }

  private async formatAdminApiError(action: string, res: Response): Promise<string> {
    const body = await res.text().catch(() => '');
    let detail = body;
    let errorCode = '';
    try {
      const parsed = JSON.parse(body);
   
      errorCode = parsed.errorMessage ?? parsed.error ?? '';
      detail = parsed.field ? `champ "${parsed.field}" — ${errorCode}` : (errorCode || body);
    } catch {
     
    }

    let hint = '';
    if (res.status === 403) {
      hint =
        ' — le service account du client Keycloak (KEYCLOAK_ADMIN_CLIENT_ID) n\'a probablement pas le rôle "manage-users" du client "realm-management"';
    } else if (errorCode === 'error-user-attribute-read-only') {
      hint =
        ' — ce champ est marqué en lecture seule côté realm ; pour "username" : Realm settings → Login (ou General) → active "Edit username"';
    }

    return `Échec de ${action} (${res.status})${detail ? ` : ${detail}` : ''}${hint}`;
  }
}
