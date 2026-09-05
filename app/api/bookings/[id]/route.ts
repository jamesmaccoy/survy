import { NextRequest, NextResponse } from "next/server";
import { getBooking } from "@/lib/firebase";
import { sendBookingConfirmationEmail } from "@/lib/email";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const booking = await getBooking(id);
    if (!booking) {
      return NextResponse.json({ success: false, error: "Booking not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: booking });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("GET /api/bookings/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const booking = await getBooking(id);
    if (!booking) {
      return NextResponse.json({ success: false, error: "Booking not found." }, { status: 404 });
    }

    const sent = await sendBookingConfirmationEmail(booking);
    if (sent) {
      return NextResponse.json({
        success: true,
        message: `Confirmation email successfully sent to ${booking.customerEmail}`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Failed to deliver confirmation email via email service." },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error("POST /api/bookings/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
