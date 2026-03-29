import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    if (user.role !== "organizer" && user.role !== "admin") {
      return NextResponse.json({ error: "Organizer role required" }, { status: 403 });
    }

    const rows = await db
      .select()
      .from(events)
      .where(eq(events.organizerId, user.userId))
      .orderBy(desc(events.createdAt));

    return NextResponse.json({ events: rows });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Organizer events error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
