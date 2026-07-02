import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({
  sendMail: mockSendMail,
}));

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: mockCreateTransport,
  },
}));

describe('EmailService', () => {
  let service: EmailService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'BREVO_SMTP_KEY') return 'test-smtp-key';
      if (key === 'BREVO_SMTP_USER') return 'test@deepskyn.com';
      if (key === 'BREVO_SENDER_EMAIL') return 'test@deepskyn.com';
      if (key === 'BREVO_SENDER_NAME') return 'Test Sender';
      if (key === 'frontendUrl') return 'http://localhost:5173';
      return null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a SMTP transport with Brevo settings', () => {
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@deepskyn.com',
          pass: 'test-smtp-key',
        },
      }),
    );
  });

  it('should send password reset email', async () => {
    mockSendMail.mockResolvedValue({});

    await service.sendPasswordResetEmail('u@u.com', '123456');

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Test Sender" <test@deepskyn.com>',
        to: 'u@u.com',
        subject: 'Your Deekspyn Password Reset Code',
        html: expect.stringContaining('123456'),
      }),
    );
  });

  it('should send report email with attachment', async () => {
    mockSendMail.mockResolvedValue({});
    const pdfBuffer = Buffer.from('fake pdf content');

    await service.sendReportEmail('report@test.com', pdfBuffer);

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'report@test.com',
        subject: 'Your DeekSkyn Skin Analysis Report',
        attachments: [
          expect.objectContaining({
            content: pdfBuffer,
            name: 'rapport.pdf',
          }),
        ],
      }),
    );
  });
});