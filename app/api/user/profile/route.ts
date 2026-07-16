import { NextRequest, NextResponse } from "next/server";
import { isUserAdmin } from "@/lib/firebase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const email = searchParams.get("email");

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId query parameter is required." }, { status: 400 });
    }

    const isAdmin = await isUserAdmin(userId, email);
    return NextResponse.json({
      success: true,
      data: {
        isAdmin
      }
    });
  } catch (err: any) {
    console.error("GET /api/user/profile error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
