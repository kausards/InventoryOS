import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [AuthModule, InventoryModule, FinanceModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
