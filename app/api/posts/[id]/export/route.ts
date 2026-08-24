import { NextRequest, NextResponse } from "next/server";
import { getProperty, listBookings } from "@/lib/firebase";

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const property = await getProperty(id);
    if (!property) {
      return NextResponse.json({ success: false, error: "Property not found." }, { status: 404 });
    }

    const bookings = await listBookings(id);
    const activeBookings = bookings.filter(
      (b: any) => b.paymentStatus !== "failed" && b.paymentStatus !== "refunded"
    );

    const icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//Simpleplek//Property Export ${id}//EN`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (const booking of activeBookings) {
      const start = new Date(booking.fromDate);
      const end = new Date(booking.toDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

      icsLines.push("BEGIN:VEVENT");
      icsLines.push(`UID:booking-${booking.id}@simpleplek.co.za`);
      icsLines.push(`DTSTAMP:${formatIcsDate(new Date())}`);
      icsLines.push(`DTSTART:${formatIcsDate(start)}`);
      icsLines.push(`DTEND:${formatIcsDate(end)}`);
      icsLines.push(`SUMMARY:Booking - ${booking.customerName || "Guest"}`);
      icsLines.push(`DESCRIPTION:Booking Reference: ${booking.id}\\nProperty: ${property.title || "Stay"}`);
      icsLines.push(`LOCATION:${property.location || property.title || "South Africa"}`);
      icsLines.push("END:VEVENT");
    }

    icsLines.push("END:VCALENDAR");

    const icsContent = icsLines.join("\r\n");

    return new Response(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="property-${id}.ics"`,
      },
    });
  } catch (err: any) {
    console.error("GET /api/posts/[id]/export error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
