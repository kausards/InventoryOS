import { Controller, Get, Query } from '@nestjs/common';
import {
  getBangladeshDivisions,
  getDistrictsByDivision,
  BANGLADESH_DISTRICTS,
} from '@growthomic/shared';

@Controller('geo')
export class GeoController {
  @Get('divisions')
  getDivisions() {
    return getBangladeshDivisions();
  }

  @Get('districts')
  getDistricts(@Query('division') division?: string) {
    if (division) {
      return getDistrictsByDivision(division);
    }
    return BANGLADESH_DISTRICTS;
  }
}
