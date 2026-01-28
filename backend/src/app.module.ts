import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { ContactsModule } from './contacts/contacts.module';
import { CompaniesModule } from './companies/companies.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    PrismaModule,
    TenantModule,
    AuthModule,
    BillingModule,
    ContactsModule,
    CompaniesModule,
    DashboardModule,
  ],
})
export class AppModule {}
