import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { MarketplaceCatalog } from './marketplace-catalog';
import { MarketplacePublishing } from './marketplace-publishing';
import { MarketplaceInstall } from './marketplace-install';
import { MarketplaceReviews } from './marketplace-reviews';
import { MarketplaceCreator } from './marketplace-creator';
import type { User } from '@prisma/client';

/**
 * S8: Marketplace — haqiqiy bozor dinamikasi (statik katalog emas).
 *   - Reyting/leaderboard: haqiqiy foydalanish + baholar asosida score
 *   - "Tasdiqlangan" (verified) belgisi: ishonchlilik chegarasidan o'tganlar
 *   - Daromad taqsimoti: har pulli o'rnatish 70/30 (kreator/platforma)
 *     CreatorLedger'da haqiqiy buxgalteriya bilan; payout stub (to'lov
 *     protsessingi ulanmagan), hisob-kitob mantig'i haqiqiy.
 *   - Y5: "yaratuvchi bonusi" — CreatorLedger'dan ALOHIDA, HAQIQIY balans
 *     krediti: yangi xaridorning birinchi to'lovida creation_price'ning
 *     yarmi original yaratuvchiga bir martalik bonus (Payout jadvali,
 *     @@unique([agentId, buyerId]) — hech qachon qayta berilmaydi).
 *
 * Ushbu klass yupqa fasad: haqiqiy mantiq domen bo'yicha alohida
 * fayllarga bo'lingan — marketplace-catalog.ts, marketplace-publishing.ts,
 * marketplace-install.ts, marketplace-reviews.ts, marketplace-creator.ts.
 * Kontroller va testlar uchun ommaviy metod imzolari o'zgarmagan.
 */
@Injectable()
export class MarketplaceService {
  private readonly catalog: MarketplaceCatalog;
  private readonly publishing: MarketplacePublishing;
  private readonly install_: MarketplaceInstall;
  private readonly reviews_: MarketplaceReviews;
  private readonly creator: MarketplaceCreator;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {
    this.catalog = new MarketplaceCatalog(this.prisma);
    this.publishing = new MarketplacePublishing(this.prisma, this.audit);
    this.install_ = new MarketplaceInstall(this.prisma, this.audit);
    this.reviews_ = new MarketplaceReviews(this.prisma);
    this.creator = new MarketplaceCreator(this.prisma, this.audit);
  }

  listPublished(search?: string) {
    return this.catalog.listPublished(search);
  }

  publish(agentId: string, user: User, price?: number, description?: string, monthlyPrice?: number) {
    return this.publishing.publish(agentId, user, price, description, monthlyPrice);
  }

  unpublish(agentId: string, user: User) {
    return this.publishing.unpublish(agentId, user);
  }

  install(publishedAgentId: string, user: User) {
    return this.install_.install(publishedAgentId, user);
  }

  review(publishedAgentId: string, user: User, rating: number, comment?: string) {
    return this.reviews_.review(publishedAgentId, user, rating, comment);
  }

  reviews(publishedAgentId: string) {
    return this.reviews_.reviews(publishedAgentId);
  }

  recordUsage(sourceAgentId: string, success: boolean) {
    return this.reviews_.recordUsage(sourceAgentId, success);
  }

  creatorDashboard(user: User) {
    return this.creator.creatorDashboard(user);
  }

  requestPayout(user: User) {
    return this.creator.requestPayout(user);
  }
}
