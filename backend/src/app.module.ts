import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { InventoryModule } from './inventory/inventory.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';
import { CashRegisterModule } from './cash-register/cash-register.module';
import { SalesModule } from './sales/sales.module';
import { ReturnsModule } from './returns/returns.module';
import { CompanySettingsModule } from './company-settings/company-settings.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MermaModule } from './merma/merma.module';
import { SuppliersModule } from './suppliers/suppliers.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuditModule,
    NotificationsModule,
    AuthModule,
    InventoryModule,
    OnboardingModule,
    CategoriesModule,
    ProductsModule,
    UsersModule,
    CashRegisterModule,
    SalesModule,
    ReturnsModule,
    CompanySettingsModule,
    MermaModule,
    SuppliersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
