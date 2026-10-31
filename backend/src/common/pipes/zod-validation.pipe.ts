import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issues = result.error.issues.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      const summaryMessage = issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join(' • ');
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: summaryMessage || 'Validation failed',
        errors: issues,
      });
    }
    return result.data;
  }
}
