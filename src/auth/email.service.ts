import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client: BrevoClient;
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    if (!apiKey) {
      this.logger.error('BREVO_API_KEY is not defined.');
    }

    this.client = new BrevoClient({
      apiKey: apiKey!,
    });

    this.senderEmail =
      this.configService.get<string>('BREVO_SENDER_EMAIL') ??
      'no-reply@gmail.com';
    this.senderName =
      this.configService.get<string>('BREVO_SENDER_NAME') ?? 'Mock Platform';
  }


  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    await this.client.transactionalEmails.sendTransacEmail({
      sender: { name: this.senderName, email: this.senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });
  }

  private buildOtpHtml(params: {
    title: string;
    intro: string;
    otp: string;
    expiry: string;
    warning: string;
  }): string {
    return `
      <div style="font-family: Arial, sans-serif; background:#0f1023; color:#ffffff; padding:32px; border-radius:20px;">
        <div style="max-width:560px; margin:0 auto; background:#1a1b3a; border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:32px;">
          <p style="margin:0 0 12px; color:#f7941d; font-size:12px; text-transform:uppercase; letter-spacing:0.12em;">${params.title}</p>
          <h1 style="margin:0 0 16px; font-size:26px; line-height:1.2;">${params.title}</h1>
          <p style="margin:0 0 24px; color:#cbd5e1; line-height:1.6;">${params.intro}</p>
          <div style="display:inline-block; padding:16px 28px; border-radius:16px; background:#f7941d; color:#ffffff; font-size:28px; font-weight:700; letter-spacing:0.2em;">${params.otp}</div>
          <p style="margin:8px 0 0; color:#94a3b8; line-height:1.6;">${params.warning}</p>
        </div>
      </div>
    `;
  }


  async sendPasswordResetEmail(email: string, otp: string): Promise<void> {
    try {
      await this.sendEmail(
        email,
        'Votre code de réinitialisation Mock Platform',
        this.buildOtpHtml({
          title: 'Réinitialisation du mot de passe',
          intro: 'Nous avons reçu une demande de réinitialisation de votre mot de passe.',
          otp,
          expiry: '15 minutes',
          warning: 'Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet e-mail.',
        }),
      );
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}`,
        error,
      );
      throw new Error('Could not send reset email');
    }
  }

  async sendLoginOtpEmail(email: string, otp: string): Promise<void> {
    try {
      await this.sendEmail(
        email,
        'Votre code de vérification Mock Platform',
        this.buildOtpHtml({
          title: 'Vérification de connexion',
          intro: 'Utilisez le code ci-dessous pour valider votre connexion.',
          otp,
          expiry: '10 minutes',
          warning:
            'Si vous n’avez pas tenté de vous connecter, changez immédiatement votre mot de passe.',
        }),
      );
      this.logger.log(`Login OTP email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send login OTP to ${email}`, error);
      throw new Error('Could not send OTP email');
    }
  }
}