import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, ticketTiers, orders, tickets } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";

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

    const tiers = await db
      .select()
      .from(ticketTiers)
      .where(eq(ticketTiers.eventId, eventId));

    const [revenueResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${orders.totalCents}), 0)` })
      .from(orders)
      .where(and(eq(orders.eventId, eventId), eq(orders.status, "paid")));

    const [checkedInResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tickets)
      .innerJoin(orders, eq(tickets.orderId, orders.id))
      .where(
        and(
          eq(orders.eventId, eventId),
          eq(orders.status, "paid"),
          eq(tickets.checkedIn, true)
        )
      );

    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        capacity: event.capacity,
        ticketsSold: event.ticketsSold,
        status: event.status,
      },
      ticketTiers: tiers,
      totalRevenueCents: revenueResult.total,
      checkedInCount: checkedInResult.count,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
