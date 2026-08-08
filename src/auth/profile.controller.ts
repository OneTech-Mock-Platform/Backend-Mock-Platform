import { BadRequestException, Body, Controller, Patch, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { KeycloakAdminService } from './keycloak-admin.service';

const MIN_PASSWORD_LENGTH = 6;

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

    if (password && password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    }

    if (Object.keys(profileData).length > 0) {
      await this.keycloakAdminService.updateProfile(req.user.keycloakId, profileData);
    }
    if (password) {
      await this.keycloakAdminService.changePassword(req.user.keycloakId, password);
    }
    return { message: 'Profile updated successfully' };
  }
}
