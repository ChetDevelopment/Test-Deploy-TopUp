import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await prisma.admin.findFirst({
      select: { email: true, active: true }
    });
    
    // Check which DB we're connected to by looking at connection string (masked)
    const dbUrl = process.env.DATABASE_URL || "";
    const maskedUrl = dbUrl.replace(/:[^:@]*@/, ":***@");
    
    return NextResponse.json({ 
      adminEmail: admin?.email, 
      active: admin?.active,
      dbConnected: !!admin,
      dbUrl: maskedUrl
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
