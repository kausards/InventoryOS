import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { TeamModule } from './team/team.module';
import { TenantsModule } from './tenants/tenants.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { CustomersModule } from './customers/customers.module';
import { OrdersModule } from './orders/orders.module';
import { GeoModule } from './geo/geo.module';
import { RiskModule } from './risk/risk.module';
import { DocumentsModule } from './documents/documents.module';
import { CouriersModule } from './couriers/couriers.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { ReturnsModule } from './returns/returns.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    HealthModule,
    AuthModule,
    RolesModule,
    TeamModule,
    TenantsModule,
    ProductsModule,
    InventoryModule,
    CustomersModule,
    OrdersModule,
    GeoModule,
    RiskModule,
    DocumentsModule,
    CouriersModule,
    IntegrationsModule,
    ReturnsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
