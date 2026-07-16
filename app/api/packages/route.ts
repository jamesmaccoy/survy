import { NextRequest, NextResponse } from "next/server";
import { createPackage, listPackages, isUserAdmin } from "@/lib/firebase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId") || undefined;
    const list = await listPackages(propertyId);
    return NextResponse.json({ success: true, data: list });
  } catch (err: any) {
    console.error("GET /api/packages error:", err);
    return NextResponse.json({ success: false, data: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const userId = request.headers.get("x-user-id");
    const email = request.headers.get("x-user-email");
    if (!userId || !(await isUserAdmin(userId, email))) {
      return NextResponse.json({ success: false, data: "Unauthorized access: admin privileges required." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      id,
      propertyId,
      name,
      price,
      description,
      multiplier,
      baseRate,
      yocoId,
      category,
      isEnabled
    } = body;

    if (!propertyId || !name || price === undefined) {
      return NextResponse.json({ success: false, data: "Missing required fields (propertyId, name, price)" }, { status: 400 });
    }

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0) {
      return NextResponse.json({ success: false, data: "price must be a positive number" }, { status: 400 });
    }

    const packageRecord = await createPackage({
      id,
      propertyId,
      name,
      price: priceNum,
      description: description || "",
      multiplier: multiplier !== undefined ? Number(multiplier) : undefined,
      baseRate: baseRate !== undefined ? Number(baseRate) : undefined,
      yocoId: yocoId || id,
      category: category || "standard",
      isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true
    });

    return NextResponse.json({ success: true, data: packageRecord }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/packages error:", err);
    return NextResponse.json({ success: false, data: err.message }, { status: 500 });
  }
}
