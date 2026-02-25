import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { ContactsModule } from './contacts/contacts.module';
import { CompaniesModule } from './companies/companies.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SettingsModule } from './settings/settings.module';
import { PipelinesModule } from './pipelines/pipelines.module';
import { DealsModule } from './deals/deals.module';
import { LeadsModule } from './leads/leads.module';
import { TasksModule } from './tasks/tasks.module';
import { ActivitiesModule } from './activities/activities.module';
import { ProductsModule } from './products/products.module';
import { MetaModule } from './meta/meta.module';
import { TodosModule } from './todos/todos.module';
import { RemindersModule } from './reminders/reminders.module';
import { CallsModule } from './calls/calls.module';
import { SmsModule } from './sms/sms.module';
import { TimelineModule } from './timeline/timeline.module';

@Module({
  imports: [
    PrismaModule,
    TenantModule,
    AuthModule,
    BillingModule,
    ContactsModule,
    CompaniesModule,
    DashboardModule,
    SettingsModule,
    PipelinesModule,
    DealsModule,
    LeadsModule,
    TasksModule,
    ActivitiesModule,
    ProductsModule,
    MetaModule,
    TodosModule,
    RemindersModule,
    CallsModule,
    SmsModule,
    TimelineModule,
  ],
})
export class AppModule {}
