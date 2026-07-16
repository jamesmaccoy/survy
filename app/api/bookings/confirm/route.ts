import { NextRequest, NextResponse } from "next/server";
import { getEstimate, updateEstimateStatus, createBooking, listBookings } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { estimateId, paymentStatus } = body;

    if (!estimateId) {
      return NextResponse.json({ success: false, error: "estimateId is required." }, { status: 400 });
    }

    const estimate = await getEstimate(estimateId);
    if (!estimate) {
      return NextResponse.json({ success: false, error: "Estimate not found." }, { status: 404 });
    }

    // Check if booking already exists for this estimateId
    const existingBookings = await listBookings();
    const existingBooking = existingBookings.find((b: any) => b.estimateId === estimateId);

    if (existingBooking) {
      // If payment status should be updated, update it
      return NextResponse.json({ success: true, booking: existingBooking, message: "Booking already confirmed." });
    }

    // Create the booking
    const booking = await createBooking({
      propertyId: estimate.propertyId,
      packageId: estimate.packageId || null,
      customerName: estimate.customerName,
      customerEmail: estimate.customerEmail,
      fromDate: estimate.fromDate,
      toDate: estimate.toDate,
      total: Number(estimate.total),
      paymentStatus: paymentStatus || "paid",
      estimateId: estimate.id,
      guests: estimate.guests || [],
      guestsDetails: estimate.guestsDetails || {}
    } as any);

    // Update estimate status to paid
    await updateEstimateStatus(estimateId, "paid");

    return NextResponse.json({ success: true, booking, message: "Booking confirmed successfully!" }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/bookings/confirm error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
