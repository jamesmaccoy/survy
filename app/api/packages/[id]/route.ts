import { NextRequest, NextResponse } from "next/server";
import { deletePackage, isUserAdmin } from "@/lib/firebase";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check admin permissions
    const userId = request.headers.get("x-user-id");
    const email = request.headers.get("x-user-email");
    if (!userId || !(await isUserAdmin(userId, email))) {
      return NextResponse.json({ success: false, error: "Unauthorized access: admin privileges required." }, { status: 403 });
    }

    const success = await deletePackage(id);
    if (!success) {
      return NextResponse.json({ success: false, error: "Package not found or delete failed." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: "Package deleted successfully." });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("DELETE /api/packages/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
