import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BusinessModule } from './business/business.module';
import { UsersModule } from './users/users.module';

// Submodules

@Module({
  imports: [
    BusinessModule,
    UsersModule,
    // TrainingModule,
    // CustomersModule,
    // OpportunitiesModule,
    // IntegrationsModule,
    // AiModule,
    // HallucinationModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
