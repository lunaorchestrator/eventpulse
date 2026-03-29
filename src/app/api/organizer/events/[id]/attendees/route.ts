import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, tickets, ticketTiers, users, orders } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id: eventId } = await params;

    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.organizerId, user.userId)))
      .limit(1);

    if (!event) {
      return NextResponse.json({ error: "Event not found or not yours" }, { status: 404 });
    }

    const attendees = await db
      .select({
        ticketId: tickets.id,
        attendeeName: users.name,
        attendeeEmail: users.email,
        tierName: ticketTiers.name,
        orderId: orders.id,
        checkedIn: tickets.checkedIn,
        checkedInAt: tickets.checkedInAt,
        purchasedAt: orders.createdAt,
      })
      .from(tickets)
      .innerJoin(orders, eq(tickets.orderId, orders.id))
      .innerJoin(users, eq(tickets.attendeeId, users.id))
      .innerJoin(ticketTiers, eq(tickets.tierId, ticketTiers.id))
      .where(and(eq(orders.eventId, eventId), eq(orders.status, "paid")));

    return NextResponse.json({ attendees });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Attendees error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
