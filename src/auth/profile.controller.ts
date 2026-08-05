import { Body, Controller, Patch, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { KeycloakAdminService } from './keycloak-admin.service';

@Controller()
export class ProfileController {
  constructor(private readonly keycloakAdminService: KeycloakAdminService) {}

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req: any,
    @Body() dto: { firstName?: string; lastName?: string; username?: string; email?: string; password?: string },
  ) {
    const { password, ...profileData } = dto;
    if (Object.keys(profileData).length > 0) {
      await this.keycloakAdminService.updateProfile(req.user.keycloakId, profileData);
    }
    if (password) {
      await this.keycloakAdminService.changePassword(req.user.keycloakId, password);
    }
    return { message: 'Profil mis à jour avec succès' };
  }
}
