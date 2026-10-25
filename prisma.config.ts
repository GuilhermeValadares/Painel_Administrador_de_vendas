import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migrações usam a conexão direta; o app usa a do pooler (DATABASE_URL).
  datasource: { url: process.env.DIRECT_URL ?? "" },
});
