import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, ticketTiers } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { createEventSchema } from "@/lib/validators";
import { eq, desc } from "drizzle-orm";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100)
    + "-" + Date.now().toString(36);
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const offset = (page - 1) * limit;

    const rows = await db
      .select()
      .from(events)
      .where(eq(events.status, "published"))
      .orderBy(desc(events.startTime))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ events: rows, page, limit });
  } catch (error) {
    console.error("List events error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    if (user.role !== "organizer" && user.role !== "admin") {
      return NextResponse.json({ error: "Organizer role required" }, { status: 403 });
    }

    const body = await request.json();
    const data = createEventSchema.parse(body);

    const slug = slugify(data.title);

    const [event] = await db
      .insert(events)
      .values({
        organizerId: user.userId,
        title: data.title,
        slug,
        description: data.description,
        location: data.location,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        capacity: data.capacity,
        coverImageUrl: data.coverImageUrl,
      })
      .returning();

    const tiers = await db
      .insert(ticketTiers)
      .values(
        data.ticketTiers.map((t) => ({
          eventId: event.id,
          name: t.name,
          priceCents: t.priceCents,
          capacity: t.capacity,
          saleStart: t.saleStart ? new Date(t.saleStart) : null,
          saleEnd: t.saleEnd ? new Date(t.saleEnd) : null,
        }))
      )
      .returning();

    return NextResponse.json({ event, ticketTiers: tiers }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error }, { status: 400 });
    }
    console.error("Create event error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
