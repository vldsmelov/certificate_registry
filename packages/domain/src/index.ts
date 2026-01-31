import { z } from 'zod';

export const PermissionKeys = [
  'exam:create',
  'exam:edit_own',
  'exam:submit',
  'exam:edit_any',
  'approval:review',
  'approval:approve',
  'approval:reject',
  'approval:bulk_action',
  'certificate:view_internal',
  'certificate:revoke',
  'certificate:reissue',
  'templates:manage',
  'users:manage',
  'export:run',
  'notifications:dispatch'
] as const;

export type PermissionKey = (typeof PermissionKeys)[number];

export type RoleDefinition = {
  name: string;
  permissions: PermissionKey[];
};

export const DefaultRoles: RoleDefinition[] = [
  {
    name: 'exam_creator',
    permissions: ['exam:create', 'exam:edit_own', 'exam:submit']
  },
  {
    name: 'approver',
    permissions: ['approval:review', 'approval:approve', 'approval:reject', 'approval:bulk_action']
  },
  {
    name: 'cert_manager',
    permissions: ['certificate:view_internal', 'certificate:revoke', 'certificate:reissue']
  },
  {
    name: 'admin',
    permissions: [...PermissionKeys]
  }
];

export const ExamGrade = z.enum(['gold', 'silver', 'fail']);
export const ExamStatus = z.enum(['draft', 'submitted', 'needs_fix', 'approved', 'rejected', 'failed']);
export const ApprovalStatus = z.enum(['pending', 'approved', 'rejected']);
export const ValidityType = z.enum(['fixed_date', 'duration', 'perpetual']);
export const CertificateStatus = z.enum(['issued', 'revoked', 'annulled']);

export const RenderSnapshotSchema = z.object({
  full_name: z.string(),
  position: z.string().nullable(),
  exam_type_name: z.string(),
  grade: ExamGrade,
  certificate_number: z.string(),
  issued_at: z.string(),
  valid_to: z.string().nullable(),
  validity_type: ValidityType,
  signer_display_name: z.string(),
  public_id: z.string()
});

export type RenderSnapshot = z.infer<typeof RenderSnapshotSchema>;

export const TemplateFieldSchema = z.object({
  key: z.string(),
  x: z.number(),
  y: z.number(),
  fontSize: z.number().default(14),
  fontColor: z.string().default('#1e293b')
});

export const TemplateConfigSchema = z.object({
  page: z.object({
    width: z.number(),
    height: z.number()
  }),
  fields: z.array(TemplateFieldSchema),
  qr: z.object({
    x: z.number(),
    y: z.number(),
    size: z.number()
  })
});

export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

export type PermissionCheck = (permission: PermissionKey) => boolean;

export function hasPermission(userPermissions: PermissionKey[], permission: PermissionKey) {
  return userPermissions.includes(permission);
}

export const AttemptSubmitSchema = z.object({
  attempt_id: z.string().uuid(),
  grade: ExamGrade,
  signer_user_id: z.string().uuid()
});

export type AttemptSubmit = z.infer<typeof AttemptSubmitSchema>;

export const IssueCertificateSchema = z.object({
  attempt_id: z.string().uuid(),
  template_version_id: z.string().uuid(),
  validity_type: ValidityType,
  valid_to: z.string().nullable(),
  validity_months: z.number().nullable()
});

export type IssueCertificateInput = z.infer<typeof IssueCertificateSchema>;
