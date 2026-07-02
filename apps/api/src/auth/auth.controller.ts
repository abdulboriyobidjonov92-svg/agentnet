import { Controller, Post, Body, Headers, HttpCode, BadRequestException } from '@nestjs/common';
import { Webhook } from 'svix';
import { ClerkSyncService, TwoFactorService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly clerkSync: ClerkSyncService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  /** Clerk webhook — foydalanuvchi yaratish/o'chirish eventlarini qabul qiladi */
  @Post('webhooks/clerk')
  @HttpCode(200)
  async clerkWebhook(
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Body() rawBody: Buffer,
  ) {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) throw new BadRequestException('Webhook secret sozlanmagan');

    const wh = new Webhook(webhookSecret);
    let event: any;
    try {
      event = wh.verify(rawBody.toString(), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch {
      throw new BadRequestException("Webhook imzosi noto'g'ri");
    }

    await this.clerkSync.handleWebhook(event);
    return { received: true };
  }

  /** Lokal dev login — Clerk'siz, email bilan kirish/ro'yxatdan o'tish */
  @Post('dev-login')
  @HttpCode(200)
  async devLogin(@Body() body: { email: string; name?: string }) {
    return this.clerkSync.devLogin(body.email, body.name);
  }

  /** 2FA sozlash — QR kod va secret qaytaradi */
  @Post('2fa/setup')
  async setup2fa(@Body() body: { userId: string; email: string }) {
    return this.twoFactor.generateSecret(body.userId, body.email);
  }

  /** 2FA tasdiqlash va yoqish */
  @Post('2fa/verify')
  async verify2fa(@Body() body: { userId: string; token: string }) {
    const ok = await this.twoFactor.verifyAndEnable(body.userId, body.token);
    return { success: ok };
  }
}
