import { Injectable, Inject, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TeamNotesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll(userId: number, pagination?: { page: number; limit: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, role: true },
    });

    const where: any = { deletedAt: null };
    if (user?.role !== 'super_admin') {
      if (!user?.departmentId) return [];
      where.departmentId = user.departmentId;
    }

    const p = pagination || { page: 1, limit: 50 };
    const skip = (p.page - 1) * p.limit;
    const [data, total] = await Promise.all([
      this.prisma.teamNote.findMany({
        where,
        skip,
        take: p.limit,
        include: {
          author: { select: { id: true, fullNameAr: true, fullNameEn: true, avatarUrl: true } },
          attachments: true,
          comments: {
            include: { author: { select: { id: true, fullNameAr: true, fullNameEn: true, avatarUrl: true } } },
            orderBy: { createdAt: 'asc' },
          },
          likes: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.teamNote.count({ where }),
    ]);
    return { data, total, page: p.page, limit: p.limit };
  }

  async create(userId: number, body: { body?: string; attachments?: any[] }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, role: true },
    });

    if (!user?.departmentId && user?.role !== 'super_admin') {
      throw new BadRequestException('User not assigned to a department');
    }

    if (user?.role === 'end_user') {
      throw new ForbiddenException('End users cannot create team notes');
    }

    if (!body.body && (!body.attachments || body.attachments.length === 0)) {
      throw new BadRequestException('Note body or attachments required');
    }

    return this.prisma.teamNote.create({
      data: {
        body: body.body || '',
        authorId: userId,
        departmentId: user?.departmentId || null,
        attachments: body.attachments?.length
          ? { create: body.attachments.map((a: any) => ({
              fileName: a.fileName,
              fileUrl: a.fileUrl,
              fileSize: a.fileSize,
              mimeType: a.mimeType,
              isVoiceNote: a.isVoiceNote || false,
              voiceDuration: a.voiceDuration,
            })) }
          : undefined,
      },
      include: { author: true, attachments: true, comments: true, likes: true },
    });
  }

  async addComment(userId: number, noteId: number, body: { body?: string }) {
    if (!body.body) throw new BadRequestException('Comment body is required');
    const { user, note } = await this.getUserAndNote(userId, noteId);
    if (user.role === 'end_user') {
      throw new ForbiddenException('End users cannot comment on team notes');
    }
    if (user.role !== 'super_admin' && note.departmentId !== user.departmentId) {
      throw new ForbiddenException('Cannot comment on another department note');
    }
    return this.prisma.teamNoteComment.create({
      data: { body: body.body, authorId: userId, noteId },
      include: {
        author: { select: { id: true, fullNameAr: true, fullNameEn: true, avatarUrl: true } },
      },
    });
  }

  async toggleLike(userId: number, noteId: number) {
    const { user, note } = await this.getUserAndNote(userId, noteId);
    if (user.role === 'end_user') {
      throw new ForbiddenException('End users cannot like team notes');
    }
    if (user.role !== 'super_admin' && note.departmentId !== user.departmentId) {
      throw new ForbiddenException('Cannot like another department note');
    }
    const existingLike = await this.prisma.teamNoteLike.findUnique({
      where: { noteId_userId: { noteId, userId } },
    });

    if (existingLike) {
      await this.prisma.teamNoteLike.delete({ where: { id: existingLike.id } });
      return { liked: false };
    }

    await this.prisma.teamNoteLike.create({ data: { noteId, userId } });
    return { liked: true };
  }

  private async getUserAndNote(userId: number, noteId: number) {
    const [user, note] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true, role: true },
      }),
      this.prisma.teamNote.findUnique({
        where: { id: noteId },
        select: { id: true, deletedAt: true, departmentId: true, authorId: true },
      }),
    ]);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!note || note.deletedAt) {
      throw new BadRequestException('Team note not found');
    }
    return { user, note };
  }

  async remove(userId: number, userRole: string, noteId: number) {
    const note = await this.prisma.teamNote.findUnique({ where: { id: noteId } });
    if (!note || note.deletedAt) {
      throw new (await import('@nestjs/common').then(m => m.NotFoundException))('Team note not found');
    }
    if (note.authorId !== userId && userRole !== 'super_admin') {
      throw new (await import('@nestjs/common').then(m => m.ForbiddenException))('Only the author or a super admin can delete this note');
    }
    await this.prisma.teamNote.update({ where: { id: noteId }, data: { deletedAt: new Date() } });
  }
}
