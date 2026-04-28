import { NextResponse } from "next/server";
import { verifyAdminCredentials } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Test login for:", body.email);
    
    const result = await verifyAdminCredentials(body.email, body.password);
    console.log("Result:", result ? "success" : "failed");
    
    return NextResponse.json({ 
      success: !!result,
      email: body.email,
      error: result ? null : "Invalid credentials"
    });
  } catch (e: any) {
    console.error("Test login error:", e.message, e.stack);
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
