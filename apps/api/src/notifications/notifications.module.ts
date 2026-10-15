import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { CreditsLedgerService } from './credits-ledger.service';
import { ConsentService } from './consent.service';
import { ElitbuzzSmsAdapter } from './adapters/elitbuzz-sms.adapter';
import { MetaWhatsAppAdapter } from './adapters/meta-whatsapp.adapter';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    CreditsLedgerService,
    ConsentService,
    ElitbuzzSmsAdapter,
    MetaWhatsAppAdapter,
  ],
  exports: [
    NotificationsService,
    CreditsLedgerService,
    ConsentService,
  ],
})
export class NotificationsModule {}
