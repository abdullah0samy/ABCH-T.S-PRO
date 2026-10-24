import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Load environment variables before anything else imports.
 *
 * `ConfigModule.forRoot()` only runs once Nest instantiates the module graph,
 * which is too late for the modules that read `process.env` at import time
 * (`auth.utils.ts` exits the process when the JWT secrets are missing) and for
 * Prisma, which resolves `DATABASE_URL` when its client is constructed.
 *
 * The file lives at the repo root because docker-compose shares it, while Nest
 * runs from `backend/`, so both locations are tried. Sourcing it from a shell
 * is not an option: the connection string contains `&`, which the shell reads
 * as a control operator.
 *
 * Variables already set in the real environment always win — this only fills
 * in what is missing, so container and CI configuration is never overwritten.
 */
const candidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const file of candidates) {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file });
  }
}
