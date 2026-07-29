import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { InventoryModule } from './inventory/inventory.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [PrismaModule, AuthModule, InventoryModule, OnboardingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
