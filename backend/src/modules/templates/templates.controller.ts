import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { TemplatesService } from './templates.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  // For attempt creation: list active template versions (no special perm beyond auth)
  @Get('/template-versions/active')
  async activeVersions() {
    return this.templates.listActiveVersions();
  }

  // Management endpoints
  @Get('/api/internal/templates')
  @RequirePermissions('templates:manage')
  async listAll() {
    return this.templates.listTemplatesWithVersions();
  }

  @Post('/api/internal/templates')
  @RequirePermissions('templates:manage')
  async createTemplate(@Req() req: any, @Body() body: any) {
    const name = String(body.name ?? '').trim();
    const description = body.description ? String(body.description).trim() : null;
    if (!name) throw new BadRequestException('name is required');
    return this.templates.createTemplate({ name, description, actorUserId: req.user?.id ?? null });
  }

  @Post('/api/internal/templates/:templateId/versions')
  @RequirePermissions('templates:manage')
  @UseInterceptors(
    FileInterceptor('background', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async createVersion(
    @Req() req: any,
    @Param('templateId') templateId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: any,
  ) {
    const version = body.version ? Number(body.version) : null;
    if (version !== null && (!Number.isFinite(version) || version <= 0)) {
      throw new BadRequestException('version must be a positive number');
    }

    const isActive = body.isActive === undefined ? true : String(body.isActive) === 'true';

    let configJson: any = null;
    if (body.configJson) {
      try {
        configJson = JSON.parse(String(body.configJson));
      } catch {
        throw new BadRequestException('configJson must be valid JSON');
      }
    }

    return this.templates.createTemplateVersion({
      templateId,
      actorUserId: req.user?.id ?? null,
      version: version ?? undefined,
      isActive,
      configJson,
      background: file
        ? {
            originalName: file.originalname,
            mimeType: file.mimetype,
            bytes: file.buffer,
          }
        : null,
    });
  }

  @Post('/api/internal/template-versions/:id/activate')
  @RequirePermissions('templates:manage')
  async activate(@Param('id') id: string) {
    return this.templates.activateVersion(id);
  }
}
