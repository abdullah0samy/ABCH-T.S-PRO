import { z } from 'zod';
import { passwordSchema } from './auth.schema';

/**
 * Admin user management input.
 *
 * These endpoints used to take `@Body() body: any` and check a few fields by
 * hand — so an unknown role, a non-numeric department id or a one-character
 * password all reached the database. Declaring the shape once keeps the
 * checks together and lets the controller work with typed input.
 */
const numericId = z
  .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
  .transform((v) => Number(v));

const identifierString = z
  .string()
  .trim()
  .min(1, 'Identifier is required')
  .max(64)
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Only letters, numbers, dots, hyphens, and underscores are allowed');

const optionalEmail = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().email('Invalid email').max(160).nullable().optional(),
);

const optionalFullNameEn = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().max(120).nullable().optional(),
);

export const userRoleSchema = z.enum([
  'super_admin',
  'supervisor',
  'agent',
  'end_user',
]);

const ALLOWED_PERMISSION_KEYS = new Set([
  'canReceiveTickets',
  'canSendTickets',
  'canViewAllDeptTickets',
  'canAssignTickets',
  'canChangeStatus',
  'canTransferTickets',
  'canArchiveTickets',
  'canExportData',
  'canViewAnalytics',
  'canManageTeamNotes',
  'canManageDeptUsers',
  'canViewAuditLogs',
  'canManageKnowledgeBase',
]);

const permissionsOverrideSchema = z.preprocess(
  (v) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
    const cleaned: Record<string, boolean | null> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (ALLOWED_PERMISSION_KEYS.has(k) && (typeof val === 'boolean' || val === null)) {
        cleaned[k] = val;
      }
    }
    return cleaned;
  },
  z.record(z.string(), z.boolean().nullable().optional()).optional(),
);

export const createUserSchema = z.object({
  badgeNumber: identifierString,
  username: identifierString,
  password: passwordSchema,
  fullNameAr: z.string().trim().min(1, 'Arabic name is required').max(120),
  fullNameEn: optionalFullNameEn,
  email: optionalEmail,
  role: userRoleSchema,
  departmentId: numericId.optional().nullable(),
  isActive: z.boolean().optional(),
  permissionsOverride: permissionsOverrideSchema,
});

export const updateUserSchema = z.object({
  badgeNumber: identifierString.optional(),
  username: identifierString.optional(),
  email: optionalEmail,
  fullNameAr: z.string().trim().min(1).max(120).optional(),
  fullNameEn: optionalFullNameEn,
  role: userRoleSchema.optional(),
  departmentId: numericId.optional().nullable(),
  isActive: z.boolean().optional(),
  forcePasswordChange: z.boolean().optional(),
  permissionsOverride: permissionsOverrideSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  forcePasswordChange: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
