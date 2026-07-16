import { NextRequest, NextResponse } from "next/server";
import { createProperty, listProperties, isUserAdmin } from "@/lib/firebase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hostId = searchParams.get("hostId") || undefined;

    const list = await listProperties(hostId || undefined);
    return NextResponse.json({ success: true, data: list, properties: list });
  } catch (err: any) {
    console.error("GET /api/posts error:", err);
    return NextResponse.json({ success: false, error: err.message, data: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const userId = request.headers.get("x-user-id");
    const email = request.headers.get("x-user-email");
    if (!userId || !(await isUserAdmin(userId, email))) {
      return NextResponse.json({ success: false, error: "Unauthorized access: admin privileges required.", data: "Unauthorized access: admin privileges required." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { hostId, name, title, slug, basePricePerNight, description, images, airbnbCalendarUrl, googleCalendarUrl, bookingType, slots } = body;

    // Use passed hostId or fallback to headers
    const activeHostId = hostId || userId;

    if (!activeHostId) {
      return NextResponse.json({ success: false, error: "Missing identity metadata parameters (hostId)", data: "Missing identity metadata parameters (hostId)" }, { status: 400 });
    }

    const resolvedTitle = title || name;
    if (!resolvedTitle || !slug || basePricePerNight === undefined) {
      return NextResponse.json({ success: false, error: "Missing required fields (title/name, slug, basePricePerNight)", data: "Missing required fields (title/name, slug, basePricePerNight)" }, { status: 400 });
    }

    const price = Number(basePricePerNight);
    if (isNaN(price) || price < 0) {
      return NextResponse.json({ success: false, error: "basePricePerNight must be a positive number", data: "basePricePerNight must be a positive number" }, { status: 400 });
    }

    const property = await createProperty({
      title: resolvedTitle,
      name: resolvedTitle,
      slug: slug.trim().toLowerCase(),
      basePricePerNight: price,
      airbnbCalendarUrl: airbnbCalendarUrl || "",
      googleCalendarUrl: googleCalendarUrl || "",
      hostId: activeHostId,
      description: description || "",
      images: images || [],
      bookingType: bookingType || "nightly",
      slots: slots || []
    });

    return NextResponse.json({ success: true, data: property, id: property.id }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/posts error:", err);
    return NextResponse.json({ success: false, error: err.message, data: err.message }, { status: 500 });
  }
}
