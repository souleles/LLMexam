import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "./guards/auth.guard";
import { AuthUser } from "./decorators/AuthUser";
import { AuthService } from "./auth.service";
import { Response } from 'express';
import { AuthorizedUser, UserInfo } from "./dto/AuthorizedUser";

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

@Post('/login')
  async login(
    @Res({ passthrough: true }) res: Response,
    @Body() body: { username: string; password: string },
  ): Promise<string> {
    try {
      const jwtToken = await this.authService.login(body);
      res.cookie('jwt', jwtToken.access_token, {
        maxAge: 60 * 1000 * 60 * 24, // 1 day expiration
        httpOnly: true,
        secure: true,
      });
      
      return jwtToken.access_token;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  @UseGuards(AuthGuard)
  @Get('/profile')
  get(@AuthUser() user: AuthorizedUser): UserInfo {
    return user.userInfo;
  }

  @UseGuards(AuthGuard)
  @Post('/logout')
  logout(@Res({ passthrough: true }) res: Response): { message: string } {
    res.clearCookie('jwt');
    return { message: 'Logged out successfully' };
  }

}