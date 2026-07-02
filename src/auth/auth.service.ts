import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EmailService } from './email.service';

type ResetTokenPayload = {
  email: string;
  resetId: string;
  purpose: 'password_reset';
};

type AuthUser = {
  id: number;
  name: string;
  email: string;
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

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private generateToken(user: { email: string }) {
    return this.jwtService.sign({ email: user.email });
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

  private async createOtpCode(
    userId: number,
    purpose: 'password_reset' | 'login_2fa',
    otp: string,
  ) {
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + (purpose === 'login_2fa' ? 10 : 15) * 60 * 1000);

    await this.passwordResetModel.deleteMany({
      where: {
        userId,
        purpose,
        consumedAt: null,
      },
    });

    return this.passwordResetModel.create({
      data: {
        userId,
        purpose,
        otpHash,
        expiresAt,
      },
    });
  }

  private sanitizeUser(user: AuthUser) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
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
      user: this.sanitizeUser(user),
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

    const otp = randomInt(100000, 999999).toString();
    await this.createOtpCode(user.id, 'login_2fa', otp);
    await this.emailService.sendLoginOtpEmail(user.email, otp);

    return {
      requiresVerification: true,
      email: user.email,
      message: 'Un code de vérification a été envoyé à votre adresse e-mail.',
    };
  }

  async verifyLoginOtp(email: string, otp: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      throw new UnauthorizedException('Code de vérification invalide ou expiré');
    }

    const record = (await this.passwordResetModel.findFirst({
      where: {
        userId: user.id,
        purpose: 'login_2fa',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })) as any;

    if (!record) {
      throw new UnauthorizedException('Code de vérification invalide ou expiré');
    }

    const isValid = await bcrypt.compare(otp, record.otpHash);
    if (!isValid) {
      throw new UnauthorizedException('Code de vérification invalide ou expiré');
    }

    await this.passwordResetModel.update({
      where: { id: record.id },
      data: {
        verifiedAt: new Date(),
        consumedAt: new Date(),
      },
    });

    const access_token = this.generateToken(user);

    return {
      access_token,
      user: this.sanitizeUser(user),
      message: 'Connexion validée avec succès.',
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const updateData: { name?: string; password?: string } = {};

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

    return this.sanitizeUser(updatedUser);
  }

  async forgotPassword(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      await this.passwordResetModel.deleteMany({
        where: {
          userId: user.id,
          purpose: 'password_reset',
          consumedAt: null,
        },
      });

      const otp = randomInt(100000, 999999).toString();
      await this.createOtpCode(user.id, 'password_reset', otp);
      await this.emailService.sendPasswordResetEmail(user.email, otp);
    }

    return {
      message: 'Si un compte existe, vous recevrez un code de réinitialisation par e-mail.',
    };
  }

  async verifyResetOtp(email: string, otp: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Code invalide ou expiré');
    }

    const resetRequest = (await this.passwordResetModel.findFirst({
      where: {
        userId: user.id,
        purpose: 'password_reset',
        consumedAt: null,
        expiresAt: { gt: new Date() },
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    })) as any;

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

    const resetRequest = (await this.passwordResetModel.findUnique({
      where: { id: payload.resetId },
    })) as any;

    if (
      !resetRequest ||
      resetRequest.purpose !== 'password_reset' ||
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
          purpose: 'password_reset',
          id: { not: resetRequest.id },
        },
      }),
    ]);

    return { message: 'Mot de passe réinitialisé avec succès.' };
  }
}