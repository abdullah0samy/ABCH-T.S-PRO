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

/** Badge and username are numeric strings in this hospital's directory. */
const numericString = z
  .string()
  .regex(/^\d+$/, 'Badge Number and Username must be numeric only')
  .min(1)
  .max(32);

export const userRoleSchema = z.enum([
  'super_admin',
  'supervisor',
  'agent',
  'end_user',
]);

const permissionsOverrideSchema = z.record(z.string(), z.boolean().nullable()).optional();

export const createUserSchema = z.object({
  badgeNumber: numericString,
  username: numericString,
  password: passwordSchema,
  fullNameAr: z.string().min(1, 'Arabic name is required').max(120),
  fullNameEn: z.string().max(120).optional().nullable(),
  email: z.string().email('Invalid email').max(160).optional().nullable(),
  role: userRoleSchema,
  departmentId: numericId.optional().nullable(),
  isActive: z.boolean().optional(),
  permissionsOverride: permissionsOverrideSchema,
});

export const updateUserSchema = z.object({
  badgeNumber: numericString.optional(),
  username: numericString.optional(),
  email: z.string().email('Invalid email').max(160).optional().nullable(),
  fullNameAr: z.string().min(1).max(120).optional(),
  fullNameEn: z.string().max(120).optional().nullable(),
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
