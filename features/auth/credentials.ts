import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

// Server-only credential verification (avoids pulling bcrypt/prisma into edge).
export async function authorizeCredentials(creds: any) {
  if (!creds?.email || !creds?.password) return null;
  const user = await prisma.user.findUnique({ where: { email: creds.email as string } });
  if (!user?.passwordHash) return null;
  const ok = await bcrypt.compare(creds.password as string, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, email: user.email, name: user.name, image: user.avatarUrl };
}
