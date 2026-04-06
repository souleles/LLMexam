import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(body: { username: string; password: string }): Promise<{ access_token: string }> {
    const user = await this.prismaService.users.findUnique({
      where: { username: body.username },
    });
    if (!user) throw new NotFoundException('Ο χρήστης δεν βρέθηκε!');

    if (!bcrypt.compareSync(body.password, user?.password || '')) {
        throw new UnauthorizedException('Λάθος κωδικός');
      }
    const payload = { sub: user.id, userInfo: {username: user.username} };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}