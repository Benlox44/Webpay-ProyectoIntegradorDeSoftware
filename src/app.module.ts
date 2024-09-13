import { Module } from '@nestjs/common';
import { PurchaseModule } from './purchase/purchase.module';

@Module({
  imports: [PurchaseModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
