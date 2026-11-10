import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';

const publicSelect = {
  id: true,
  handle: true,
  displayName: true,
  bio: true,
  profilePublic: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        ...publicSelect,
        email: true,
        role: true,
        uiLanguage: true,
        mature: true,
        birthYear: true,
        emailOnRelease: true,
        pushOnRelease: true,
        analyticsOptOut: true,
        suspendedUntil: true,
        _count: { select: { works: true, follows: true, notifications: { where: { readAt: null } } } },
      },
    });
    return u;
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    if (dto.mature) {
      // Mature content needs an 18+ declaration; under-18 accounts cannot opt in (doc 10).
      const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { birthYear: true } });
      if (!u.birthYear || new Date().getUTCFullYear() - u.birthYear < 18) {
        throw new ForbiddenException('Mature works are for accounts aged 18 or over');
      }
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        ...publicSelect,
        email: true,
        role: true,
        uiLanguage: true,
        mature: true,
        emailOnRelease: true,
        pushOnRelease: true,
        analyticsOptOut: true,
      },
    });
  }

  /** Writer profile by handle, with their public works. */
  async profile(handle: string) {
    const u = await this.prisma.user.findUnique({
      where: { handle },
      select: {
        ...publicSelect,
        works: {
          where: { deletedAt: null, firstPublicAt: { not: null } },
          orderBy: { lastPublicAt: 'desc' },
          select: {
            id: true,
            slug: true,
            title: true,
            synopsis: true,
            language: true,
            kind: true,
            status: true,
            rating: true,
            coverKey: true,
            lastPublicAt: true,
            _count: { select: { parts: { where: { state: 'public' } }, follows: true } },
          },
        },
        _count: { select: { works: { where: { firstPublicAt: { not: null } } } } },
      },
    });
    if (!u) throw new NotFoundException('No such writer');
    const followers = await this.prisma.follow.count({
      where: { work: { ownerId: u.id } },
    });
    return { ...u, followers };
  }
}
