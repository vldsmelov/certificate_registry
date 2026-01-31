import { Resend } from 'resend';

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export class ResendProvider implements EmailProvider {
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage) {
    await this.client.emails.send({
      from: 'noreply@cert-registry.local',
      to: message.to,
      subject: message.subject,
      html: message.html
    });
  }
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage) {
    console.info('[email] send', message);
  }
}
