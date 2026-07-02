import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client: BrevoClient;
  private readonly senderEmail: string;
  private readonly senderName: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    if (!apiKey) {
      this.logger.error('BREVO_API_KEY is not defined.');
    }

    this.client = new BrevoClient({
      apiKey: apiKey!,
    });

    this.frontendUrl =
      this.configService.get<string>('frontendUrl') ?? 'http://localhost:5173';

    this.senderEmail =
      this.configService.get<string>('BREVO_SENDER_EMAIL') ??
      'no-reply@deekspyn.com';
    this.senderName =
      this.configService.get<string>('BREVO_SENDER_NAME') ?? 'Deekspyn';
  }

  // ── Méthode privée pour envoyer ─────────────────
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
          <p style="margin:24px 0 0; color:#cbd5e1; line-height:1.6;">Ce code expire dans ${params.expiry}.</p>
          <p style="margin:12px 0 0; color:#94a3b8; line-height:1.6;">${params.warning}</p>
        </div>
      </div>
    `;
  }

  // ── Password Reset ──────────────────────────────
  async sendPasswordResetEmail(email: string, otp: string): Promise<void> {
    try {
      await this.sendEmail(
        email,
        'Your Deekspyn Password Reset Code',
        this.buildOtpHtml({
          title: 'Password Reset Request',
          intro: 'We received a request to reset your password.',
          otp,
          expiry: '15 minutes',
          warning: 'If you did not request this, please ignore this email.',
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

  // ── Login 2FA OTP ───────────────────────────────
  async sendLoginOtpEmail(email: string, otp: string): Promise<void> {
    try {
      await this.sendEmail(
        email,
        'Your Deekspyn Login Verification Code',
        this.buildOtpHtml({
          title: 'Login Verification',
          intro: 'Use the code below to complete your sign-in.',
          otp,
          expiry: '10 minutes',
          warning:
            'If you did not attempt to sign in, change your password immediately.',
        }),
      );
      this.logger.log(`Login OTP email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send login OTP to ${email}`, error);
      throw new Error('Could not send OTP email');
    }
  }

  async sendLoginAlertEmail(
    email: string,
    details: {
      ip?: string;
      city?: string;
      countryName?: string;
      userAgent?: string;
      time?: string;
    },
  ): Promise<void> {
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; background:#0f1023; color:#ffffff; padding:32px; border-radius:20px;">
          <div style="max-width:560px; margin:0 auto; background:#1a1b3a; border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:32px;">
            <p style="margin:0 0 12px; color:#f7941d; font-size:12px; text-transform:uppercase; letter-spacing:0.12em;">Security alert</p>
            <h1 style="margin:0 0 16px; font-size:26px; line-height:1.2;">⚠️ Unusual sign-in detected on your Deekspyn account</h1>
            <ul style="margin:24px 0 0; padding-left:18px; color:#cbd5e1; line-height:1.8;">
              <li>IP: ${details.ip ?? 'Unknown'}</li>
              <li>City: ${details.city ?? 'Unknown'}</li>
              <li>Country: ${details.countryName ?? 'Unknown'}</li>
              <li>Browser: ${details.userAgent ?? 'Unknown'}</li>
              <li>Time: ${details.time ?? 'Unknown'}</li>
            </ul>
          </div>
        </div>
      `;

      await this.sendEmail(
        email,
        '⚠️ Unusual sign-in detected on your Deekspyn account',
        html,
      );
    } catch (error) {
      this.logger.error(`Failed to send login alert email to ${email}`, error);
      return undefined;
    }
  }

  async sendReportEmail(email: string, pdfBuffer: Buffer): Promise<void> {
    try {
      await this.client.transactionalEmails.sendTransacEmail({
        sender: { name: this.senderName, email: this.senderEmail },
        to: [{ email }],
        subject: 'Your DeekSkyn Skin Analysis Report',
        htmlContent:
          '<p>Your skin analysis report is attached as a PDF.</p>',
        attachment: [
          {
            content: pdfBuffer.toString('base64'),
            name: 'rapport.pdf',
          },
        ],
      });
    } catch (error) {
      this.logger.error(`Failed to send report email to ${email}`, error);
      throw new Error('Could not send report PDF email');
    }
  }

  async sendPremiumWelcomeEmail(
    email: string,
    name?: string | null,
  ): Promise<void> {
    try {
      const displayName = name?.trim() || 'there';
      await this.sendEmail(
        email,
        '✦ Welcome to DeepSkyn Premium',
        `
          <div style="font-family: Arial, sans-serif; background:#0f1023; color:#ffffff; padding:32px; border-radius:20px;">
            <div style="max-width:560px; margin:0 auto; background:#1a1b3a; border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:32px;">
              <h1 style="margin:0 0 16px; font-size:26px; line-height:1.2;">Hey ${displayName}</h1>
              <p style="margin:0 0 24px; color:#cbd5e1; line-height:1.6;">Welcome to DeepSkyn Premium.</p>
              <p><a href="${this.frontendUrl}/dashboard" style="color:#f7941d;">Go to your dashboard</a></p>
              <p><a href="${this.frontendUrl}/settings/subscription" style="color:#f7941d;">Manage subscription</a></p>
            </div>
          </div>
        `,
      );
    } catch (error) {
      this.logger.error(`Failed to send premium welcome email to ${email}`, error);
      return undefined;
    }
  }
}