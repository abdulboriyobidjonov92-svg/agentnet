import * as nodemailer from 'nodemailer';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

export const smtpEmailConnector: ConnectorDefinition = {
  id: 'smtp-email',
  name: 'Email (SMTP)',
  category: 'messaging',
  region: 'global',
  description: 'Send real emails through any SMTP server (Gmail, Mail.ru, corporate).',
  availability: 'live',
  auth: {
    type: 'basic',
    fields: [
      { key: 'host', label: 'SMTP host', required: true, placeholder: 'smtp.gmail.com' },
      { key: 'port', label: 'Port', required: false, placeholder: '587' },
      { key: 'user', label: 'Username / email', required: true },
      { key: 'password', label: 'Password / app password', required: true, secret: true },
      { key: 'from', label: 'From address', required: false, placeholder: 'you@company.uz' },
    ],
  },
  actions: [
    {
      id: 'send_email',
      label: 'Send email',
      description: 'Sends an email with subject and body.',
      params: [
        { key: 'to', label: 'Recipient email', type: 'string', required: true },
        { key: 'subject', label: 'Subject', type: 'string', required: true },
        { key: 'body', label: 'Body (plain text)', type: 'string', required: true },
      ],
      returns: '{ message_id, accepted }',
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    if (actionId !== 'send_email') return fail(`Unknown action: ${actionId}`);
    try {
      const transporter = nodemailer.createTransport({
        host: ctx.config.host,
        port: Number(ctx.config.port ?? 587),
        secure: Number(ctx.config.port ?? 587) === 465,
        auth: { user: ctx.config.user, pass: ctx.config.password },
        connectionTimeout: 15_000,
      });
      const info = await transporter.sendMail({
        from: ctx.config.from || ctx.config.user,
        to: params.to,
        subject: params.subject,
        text: params.body,
      });
      return ok({ message_id: info.messageId, accepted: info.accepted });
    } catch (e: any) {
      return fail(`SMTP: ${e.message}`);
    }
  },
};
