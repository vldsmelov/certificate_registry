import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExamTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.examType.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });
    return items;
  }
}
