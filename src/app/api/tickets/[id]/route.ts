import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, ticketTiers, events } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, id), eq(tickets.attendeeId, user.userId)))
      .limit(1);

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const [tier] = await db
      .select()
      .from(ticketTiers)
      .where(eq(ticketTiers.id, ticket.tierId))
      .limit(1);

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, tier.eventId))
      .limit(1);

    return NextResponse.json({
      ticket,
      tier: { id: tier.id, name: tier.name, priceCents: tier.priceCents },
      event: { id: event.id, title: event.title, startTime: event.startTime, location: event.location },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get ticket error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
