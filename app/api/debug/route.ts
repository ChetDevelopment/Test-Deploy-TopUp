import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await prisma.admin.findFirst({
      select: { email: true, active: true }
    });
    const dbUrl = process.env.DATABASE_URL?.substring(0, 50) + "...";
    return NextResponse.json({ 
      adminEmail: admin?.email, 
      active: admin?.active,
      dbConnected: !!admin,
      dbUrl: dbUrl 
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
