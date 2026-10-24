import { z } from 'zod';

/**
 * Password policy, in one place so the self-service change, the admin reset
 * and any future signup flow cannot drift apart.
 *
 * The 72-byte ceiling is not arbitrary: bcrypt silently truncates beyond it,
 * so a longer password would give a false sense of strength.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(72, 'Password must be at most 72 characters')
  .refine((v) => /[a-z]/.test(v), 'Password must contain a lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Password must contain an uppercase letter')
  .refine((v) => /[0-9]/.test(v), 'Password must contain a digit');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must differ from the current one',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Identifier is required')
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid identifier format'),
  password: z.string().min(1, 'Password is required').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
