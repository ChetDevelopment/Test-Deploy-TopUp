import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { z } from "zod";
import {
  verifyAdminCredentials,
  createAdminSession,
  setAdminSessionCookie,
  clearAdminSessionCookie,
} from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }

    console.log("Login attempt:", parsed.data.email);
    
    const admin = await verifyAdminCredentials(parsed.data.email, parsed.data.password);
    console.log("verifyAdminCredentials result:", admin ? "success" : "failed");
    
    if (!admin) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await createAdminSession(admin);
    await setAdminSessionCookie(token);

    return NextResponse.json({ ok: true, email: admin.email });
  } catch (e: any) {
    console.error("Login error:", e.message);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE() {
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true });
}

