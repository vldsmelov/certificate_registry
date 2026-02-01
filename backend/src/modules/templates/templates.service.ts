import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join, extname } from 'path';

type Upload = {
  originalName: string;
  mimeType: string;
  bytes: Buffer;
};

function safeExt(mimeType: string, originalName: string): string {
  const ext = extname(originalName).toLowerCase();
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return '.jpg';
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') return ext === '.jpeg' ? '.jpg' : ext;
  return '.bin';
}

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private storageRoot() {
    return process.env.TEMPLATE_STORAGE_DIR || '/app/data/templates';
  }

  private async ensureDirs() {
    await fs.mkdir(this.storageRoot(), { recursive: true });
  }

  async listActiveVersions() {
    const versions = await this.prisma.templateVersion.findMany({
      where: {
        isActive: true,
        template: { isArchived: false },
      },
      orderBy: [{ template: { name: 'asc' } }, { version: 'desc' }],
      include: { template: { select: { id: true, name: true } } },
    });

    return versions.map((v) => ({
      id: v.id,
      templateId: v.templateId,
      templateName: v.template.name,
      version: v.version,
      backgroundPath: v.backgroundPath,
      configJson: v.configJson,
    }));
  }

  async listTemplatesWithVersions() {
    const templates = await this.prisma.template.findMany({
      orderBy: { name: 'asc' },
      include: {
        versions: { orderBy: { version: 'desc' } },
      },
    });
    return templates;
  }

  async createTemplate(opts: { name: string; description: string | null; actorUserId: string | null }) {
    return this.prisma.template.create({
      data: {
        name: opts.name,
        description: opts.description,
        createdById: opts.actorUserId,
      },
    });
  }

  async createTemplateVersion(opts: {
    templateId: string;
    actorUserId: string | null;
    version?: number;
    isActive: boolean;
    configJson: any;
    background: Upload | null;
  }) {
    const template = await this.prisma.template.findUnique({ where: { id: opts.templateId } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.isArchived) throw new BadRequestException('Template is archived');

    const nextVersion = async () => {
      const max = await this.prisma.templateVersion.aggregate({
        where: { templateId: opts.templateId },
        _max: { version: true },
      });
      return (max._max.version ?? 0) + 1;
    };

    const version = opts.version ?? (await nextVersion());

    await this.ensureDirs();

    const id = randomUUID();
    let backgroundPath: string | null = null;

    if (opts.background) {
      const ext = safeExt(opts.background.mimeType, opts.background.originalName);
      const filename = `${id}${ext}`;
      const abs = join(this.storageRoot(), filename);
      await fs.writeFile(abs, opts.background.bytes);
      backgroundPath = filename; // store relative
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.templateVersion.create({
        data: {
          id,
          templateId: opts.templateId,
          version,
          isActive: opts.isActive,
          backgroundPath,
          configJson: opts.configJson,
          createdById: opts.actorUserId,
        },
      });

      if (opts.isActive) {
        await tx.templateVersion.updateMany({
          where: { templateId: opts.templateId, id: { not: created.id } },
          data: { isActive: false },
        });
      }

      return created;
    });
  }

  async activateVersion(versionId: string) {
    const v = await this.prisma.templateVersion.findUnique({ where: { id: versionId } });
    if (!v) throw new NotFoundException('Template version not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.templateVersion.updateMany({
        where: { templateId: v.templateId },
        data: { isActive: false },
      });
      return tx.templateVersion.update({
        where: { id: v.id },
        data: { isActive: true },
      });
    });
  }
}
