import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoodProduct } from '../food-catalog/models/food-product.entity';
import { User } from '../identity/models/user.entity';
import { FoodReview } from './models/food-review.entity';
import { FoodReport } from './models/food-report.entity';
import { ReportEvidence } from './models/report-evidence.entity';
import { ReviewController } from './controllers/review.controller';
import { ReportController } from './controllers/report.controller';
import { ReviewService } from './services/review.service';
import { ReportService } from './services/report.service';
import { ReportEvidenceService } from './services/report-evidence.service';

// Feature F11 & F13: Community Area Module Registration
@Module({
  imports: [TypeOrmModule.forFeature([
    FoodReview, FoodReport, ReportEvidence, FoodProduct, User,
  ])],
  controllers: [ReviewController, ReportController],
  providers: [ReviewService, ReportService, ReportEvidenceService],
  exports: [ReviewService, ReportService],
})
export class CommunityModule {}
