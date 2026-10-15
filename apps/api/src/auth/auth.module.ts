import { Module, Global } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, PermissionsGuard],
  exports: [AuthService, AuthGuard, PermissionsGuard],
})
export class AuthModule {}
