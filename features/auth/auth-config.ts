import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/db/prisma";

// Full server config: edge-safe config + Prisma adapter for OAuth persistence.
// Importing this module is only safe in Node runtime (API routes, server components).
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
});

export type { MemberRole } from "@prisma/client";
