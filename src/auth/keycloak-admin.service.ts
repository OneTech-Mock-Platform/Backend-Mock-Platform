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

    if (!res.ok) throw new HttpException('Authentication failed, please try again later', res.status);

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
      throw new HttpException(await this.formatAdminApiError('update the profile', res), res.status);
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
      throw new HttpException(await this.formatAdminApiError('change the password', res), res.status);
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
      // non-JSON response, ignore the body
    }

    const message = this.translateError(errorCode, field, res.status);
    return `Failed to ${action}: ${message}`;
  }

  private translateError(errorCode: string, field: string, status: number): string {
    if (errorCode === 'error-user-attribute-read-only' || /user name is missing/i.test(errorCode)) {
      return field
        ? `the "${field}" field is required or cannot be changed`
        : 'username is required';
    }
    if (status === 403) {
      return 'you do not have the necessary permissions to perform this action';
    }
    if (status === 409) {
      return 'this value is already used by another account';
    }
    if (status === 404) {
      return 'user not found';
    }
    return errorCode || 'an error occurred, please try again';
  }
}
