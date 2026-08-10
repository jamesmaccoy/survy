import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, createCustomToken } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ success: false, error: "idToken parameter is required." }, { status: 400 });
    }

    const decodedToken = await verifyIdToken(idToken);
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ success: false, error: "Invalid or expired identity token." }, { status: 401 });
    }

    const customToken = await createCustomToken(decodedToken.uid);

    return NextResponse.json({
      success: true,
      customToken
    });
  } catch (err: any) {
    console.error("POST /api/auth/custom-token error:", err);
    return NextResponse.json({
      success: false,
      error: err.message,
      stack: err.stack,
      data: err.stack
    }, { status: 500 });
  }
}
