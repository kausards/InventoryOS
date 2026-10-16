import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
