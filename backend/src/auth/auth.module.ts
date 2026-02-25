import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsGuard } from './permissions.guard';
import { AUTH } from './constants';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION',
      signOptions: { expiresIn: AUTH.ACCESS_EXPIRES_IN },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
