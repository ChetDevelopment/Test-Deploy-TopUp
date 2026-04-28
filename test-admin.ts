import { prisma } from "./lib/prisma";
import bcrypt from "bcryptjs";

async function test() {
  const admin = await prisma.admin.findFirst();
  console.log("Admin email:", admin?.email);
  console.log("Admin active:", admin?.active);
  
  if (admin) {
    const ok = await bcrypt.compare("tykhai123", admin.passwordHash);
    console.log("Password 'tykhai123' matches:", ok);
    
    const ok2 = await bcrypt.compare("admin123", admin.passwordHash);
    console.log("Password 'admin123' matches:", ok2);
  }
  
  process.exit(0);
}

test();
