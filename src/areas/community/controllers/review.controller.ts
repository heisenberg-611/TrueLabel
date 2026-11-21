import {
  Controller, Get, Post, Body, Param, Query, ParseIntPipe, Req, Res,
  Render, UseGuards, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ReviewService } from '../services/review.service';
import { CreateReviewDto, ReplyToReviewDto } from '../models/dto/create-review.dto';
import { AuthenticatedGuard } from '../../../common/guards/authenticated.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

// Feature F11: Thin MVC Controller for Credibility-Weighted Food Reviews
@Controller('community')
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Get('products/:productId/reviews')
  @Render('areas/community/views/reviews')
  async view(
    @Param('productId', ParseIntPipe) id: number,
    @Req() req: Request,
    @Query('success') success?: string,
    @Query('error') error?: string,
  ) {
    const user = req.session?.user || null;
    const data = await this.reviews.forProduct(id, user);
    return {
      title: `Consumer reviews for ${data.product.name} — TrueLabel`,
      activeNav: 'catalog',
      product: data.product,
      reviews: data.viewReviews,
      reviewCount: data.reviewCount,
      averageRating: data.averageRating,
      dimensionAverages: data.dimensionAverages,
      alreadyReviewed: data.alreadyReviewed,
      canReview: data.canReview,
      user,
      success,
      error,
    };
  }

  @Post('products/:productId/reviews')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('consumer')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(
    @Param('productId', ParseIntPipe) id: number,
    @Body() dto: CreateReviewDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.reviews.create(id, req.session.user.id, dto);
      return res.redirect(
        `/community/products/${id}/reviews?success=${encodeURIComponent('Your credibility-weighted review has been published.')}`,
      );
    } catch (err: any) {
      return res.redirect(
        `/community/products/${id}/reviews?error=${encodeURIComponent(err.message || 'Unable to save review.')}`,
      );
    }
  }

  @Post('reviews/:reviewId/edit')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('consumer')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async update(
    @Param('reviewId', ParseIntPipe) id: number,
    @Body() dto: CreateReviewDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const review = await this.reviews.update(id, req.session.user.id, dto);
    return res.redirect(
      `/community/products/${review.productId}/reviews?success=${encodeURIComponent('Your review was updated and product ratings were recalculated.')}`,
    );
  }

  @Post('reviews/:reviewId/delete')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('consumer')
  async remove(
    @Param('reviewId', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const productId = await this.reviews.remove(id, req.session.user.id);
    return res.redirect(
      `/community/products/${productId}/reviews?success=${encodeURIComponent('Your review has been removed.')}`,
    );
  }

  @Post('reviews/:reviewId/reply')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('manufacturer', 'admin')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async reply(
    @Param('reviewId', ParseIntPipe) id: number,
    @Body() dto: ReplyToReviewDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const review = await this.reviews.reply(id, dto.reply, req.session.user);
    return res.redirect(
      `/community/products/${review.productId}/reviews?success=${encodeURIComponent('Manufacturer response saved.')}`,
    );
  }

  // Feature F12: Admin Moderation - permanently delete review
  @Post('reviews/:reviewId/admin-delete')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('admin')
  async adminRemove(
    @Param('reviewId', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const productId = await this.reviews.adminRemove(id, req.session.user);
    return res.redirect(
      `/community/products/${productId}/reviews?success=${encodeURIComponent('The customer review has been permanently deleted by administrator.')}`,
    );
  }

  // Feature F12: Admin Moderation - toggle review visibility
  @Post('reviews/:reviewId/toggle-visibility')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('admin')
  async toggleVisibility(
    @Param('reviewId', ParseIntPipe) id: number,
    @Body('visibility') visibility: 'visible' | 'hidden',
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const review = await this.reviews.adminToggleVisibility(
      id,
      visibility || 'hidden',
      req.session.user,
    );
    return res.redirect(
      `/community/products/${review.productId}/reviews?success=${encodeURIComponent(`Review visibility was updated to ${visibility}.`)}`,
    );
  }
}
