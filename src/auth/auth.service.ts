import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EmailService } from './email.service';
import { randomInt } from 'crypto';

type ResetTokenPayload = {
  email: string;
  resetId: string;
  purpose: 'password_reset';
};


@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  private get passwordResetModel() {
    return (this.prisma as PrismaService & {
      passwordReset: {
        deleteMany: Function;
        create: Function;
        findFirst: Function;
        update: Function;
        findUnique: Function;
      };
    }).passwordReset;
  }

  private generateToken(user: { email: string }) {
    const payload = { email: user.email };
    return this.jwtService.sign(payload);
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private generateResetToken(payload: ResetTokenPayload) {
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  private async verifyResetToken(resetToken: string): Promise<ResetTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<ResetTokenPayload>(resetToken);
      if (payload.purpose !== 'password_reset') {
        throw new UnauthorizedException('Lien de réinitialisation invalide ou expiré');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Lien de réinitialisation invalide ou expiré');
    }
  }

  async register(dto: CreateUserDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        password: hashedPassword,
      },
    });

    const access_token = this.generateToken(user);
    return {
      access_token,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  async login(dto: LoginUserDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const access_token = this.generateToken(user);
    return {
      access_token,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Vérifier le mot de passe actuel si on veut changer le mot de passe
    /*if (dto.currentPassword && dto.newPassword) {
      const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
      if (!isMatch) {
        throw new UnauthorizedException('Mot de passe actuel incorrect');
      }
    }*/

    // Préparer les données à mettre à jour
    const updateData: any = {};
    if (dto.name) {
      updateData.name = dto.name;
    }
    if (dto.newPassword) {
      updateData.password = await bcrypt.hash(dto.newPassword, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
    };
  }


  async forgotPassword(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      await this.passwordResetModel.deleteMany({
        where: { userId: user.id, consumedAt: null },
      });

      const otp = randomInt(100000, 999999).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      await this.passwordResetModel.create({
        data: {
          userId: user.id,
          otpHash,
          expiresAt,
        },
      });

      await this.emailService.sendPasswordResetEmail(user.email, otp);
    }

    return { message: 'Si un compte existe, vous recevrez un code de réinitialisation par e-mail.' };
  }

  async verifyResetOtp(email: string, otp: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Code invalide ou expiré');
    }

    const resetRequest = await this.passwordResetModel.findFirst({
      where: {
        userId: user.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetRequest) {
      throw new UnauthorizedException('Code invalide ou expiré');
    }

    const isMatch = await bcrypt.compare(otp, resetRequest.otpHash);
    if (!isMatch) {
      throw new UnauthorizedException('Code invalide ou expiré');
    }

    await this.passwordResetModel.update({
      where: { id: resetRequest.id },
      data: { verifiedAt: new Date() },
    });

    return {
      resetToken: this.generateResetToken({
        email: user.email,
        resetId: resetRequest.id,
        purpose: 'password_reset',
      }),
      message: 'Code vérifié avec succès.',
    };
  }

  async resetPassword(resetToken: string, newPassword: string) {
    const payload = await this.verifyResetToken(resetToken);

    const resetRequest = await this.passwordResetModel.findUnique({
      where: { id: payload.resetId },
    });

    if (
      !resetRequest ||
      resetRequest.consumedAt ||
      resetRequest.verifiedAt === null ||
      resetRequest.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Lien de réinitialisation invalide ou expiré');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user || user.id !== resetRequest.userId) {
      throw new UnauthorizedException('Lien de réinitialisation invalide ou expiré');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      this.passwordResetModel.update({
        where: { id: resetRequest.id },
        data: { consumedAt: new Date() },
      }),
      this.passwordResetModel.deleteMany({
        where: {
          userId: user.id,
          id: { not: resetRequest.id },
        },
      }),
    ]);

    return { message: 'Mot de passe réinitialisé avec succès.' };
  }


}
