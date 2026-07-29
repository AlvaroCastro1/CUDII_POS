import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Public() // Endpoint público (protegido por lógica interna)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createOnboardingDto: CreateOnboardingDto) {
    return this.onboardingService.initializeTenant(createOnboardingDto);
  }
}
