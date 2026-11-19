// Feature F16: Food Preference & Allergen Profile
import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Render,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  PreferenceService,
  STANDARD_ALLERGENS,
  STANDARD_DIETS,
} from '../services/preference.service';
import { UpdatePreferenceProfileDto } from '../models/dto/update-preference-profile.dto';
import { AuthenticatedGuard } from '../../../common/guards/authenticated.guard';

@Controller('personal')
export class PreferenceController {
  constructor(private readonly preferenceService: PreferenceService) {}

  /**
   * Render User Dietary & Allergen Profile Form
   * Personal health profile is strictly for Consumers (and Admin override).
   */
  @Get('profile')
  @UseGuards(AuthenticatedGuard)
  @Render('areas/personal-food/views/profile')
  async getProfile(
    @Req() req: Request,
    @Query('saved') saved?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const user = req.session.user;
    if (user.role !== 'consumer' && user.role !== 'admin') {
      if (res && res.redirect) {
        res.redirect(`/dashboard/${user.role}`);
        return;
      }
    }

    const userId = user.id;
    const profile = await this.preferenceService.findOrCreate(userId);
    const metabolicPlan = this.preferenceService.calculateMetabolicPlan(profile);

    return {
      title: 'Dietary Profile & Allergen Preferences — TrueLabel',
      activeNav: 'profile',
      profile,
      metabolicPlan,
      standardAllergens: STANDARD_ALLERGENS,
      standardDiets: STANDARD_DIETS,
      saved: saved === 'true',
      user,
    };
  }

  /**
   * Save / Update Dietary & Allergen Profile
   */
  @Post('profile')
  @UseGuards(AuthenticatedGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateProfile(
    @Body() dto: UpdatePreferenceProfileDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const userId = req.session.user.id;
      // In standard HTML form POSTs, unchecking all checkboxes omits the keys from body.
      // Explicitly normalize to empty array when omitted so unchecking can be persisted.
      const normalizedDto: UpdatePreferenceProfileDto = {
        ...dto,
        allergies: req.body.allergies
          ? Array.isArray(req.body.allergies)
            ? req.body.allergies
            : [req.body.allergies]
          : [],
        dietaryPreferences: req.body.dietaryPreferences
          ? Array.isArray(req.body.dietaryPreferences)
            ? req.body.dietaryPreferences
            : [req.body.dietaryPreferences]
          : [],
      };
      await this.preferenceService.updateProfile(userId, normalizedDto);
      return res.redirect('/personal/profile?saved=true');
    } catch (err) {
      const profile = await this.preferenceService.findOrCreate(req.session.user.id);
      const mergedProfile = { ...profile, ...dto };
      const metabolicPlan = this.preferenceService.calculateMetabolicPlan(mergedProfile as any);
      return res.render('areas/personal-food/views/profile', {
        title: 'Dietary Profile & Allergen Preferences — TrueLabel',
        activeNav: 'profile',
        profile: mergedProfile,
        metabolicPlan,
        standardAllergens: STANDARD_ALLERGENS,
        standardDiets: STANDARD_DIETS,
        error: err.message || 'Failed to update dietary profile preferences',
        user: req.session.user,
      });
    }
  }
}

