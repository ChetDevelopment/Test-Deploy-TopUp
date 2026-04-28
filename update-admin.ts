import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function updateAdmin() {
  const hash = await bcrypt.hash("tykhai123", 10);
  await prisma.admin.updateMany({
    data: { passwordHash: hash }
  });
  console.log("Admin password updated to tykhai123");
  await prisma.$disconnect();
}

updateAdmin();
