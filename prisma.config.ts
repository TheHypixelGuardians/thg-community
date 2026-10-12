import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Not env(): that throws when the variable is unset, and prisma generate (yarn build, the Docker
    // build) does not need a database.
    url: process.env.DATABASE_URL ?? '',
  },
});
