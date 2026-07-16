import { NextRequest, NextResponse } from "next/server";
import { promoteUserToAdmin } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing required parameter: userId" }, { status: 400 });
    }

    await promoteUserToAdmin(userId);
    console.log(`[Dev Mock Sub] Promoted user ${userId} to Pro role (admin) successfully.`);

    return NextResponse.json({ success: true, message: "User promoted to Pro role." });
  } catch (err: any) {
    console.error("Mock subscribe confirmation error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
