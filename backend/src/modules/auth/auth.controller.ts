import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthUser } from './auth.types';

type LoginDto = { email: string; password: string };

@Controller('/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('/login')
  async login(@Body() dto: LoginDto) {
    const email = (dto.email || '').trim().toLowerCase();
    const password = dto.password || '';
    const result = await this.auth.login(email, password);
    if (!result) throw new UnauthorizedException('Invalid credentials');
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  me(@CurrentUser() user: AuthUser) {
    return { id: user.id, email: user.email, displayName: user.displayName, permissions: user.permissions };
  }
}
