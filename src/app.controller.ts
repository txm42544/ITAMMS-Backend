import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/auth.decorators';

@ApiTags('Health')
@Controller()
export class AppController {
  @Public()
  @Get()
  root() {
    return { name: 'IT Asset Management API', version: '1.0' };
  }

  @Public()
  @Get('health')
  health() {
    return { status: 'OK', time: new Date().toISOString() };
  }
}
