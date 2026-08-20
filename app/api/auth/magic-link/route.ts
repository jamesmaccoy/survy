import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUserByEmail, createCustomToken } from "@/lib/firebase";
import { sendMagicLinkEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, origin } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: "email parameter is required." }, { status: 400 });
    }

    if (!origin) {
      return NextResponse.json({ success: false, error: "origin parameter is required." }, { status: 400 });
    }

    // Get or create user
    const uid = await getOrCreateUserByEmail(email);

    // Create a custom token for that user
    const customToken = await createCustomToken(uid);

    // Construct the magic link
    const magicLink = `${origin}/login?token=${customToken}`;

    // Send the email
    const emailResult = await sendMagicLinkEmail(email, magicLink);

    if (!emailResult) {
      return NextResponse.json({ success: false, error: "Failed to send magic link email." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Magic link sent successfully."
    });
  } catch (err) {
    console.error("POST /api/auth/magic-link error:", err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred during magic link generation."
    }, { status: 500 });
  }
}
