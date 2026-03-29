import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, ticketTiers, orders } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { createOrderSchema } from "@/lib/validators";
import { eq, and, sql } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id: eventId } = await params;

    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.status, "published")))
      .limit(1);

    if (!event) {
      return NextResponse.json({ error: "Event not found or not on sale" }, { status: 404 });
    }

    const body = await request.json();
    const data = createOrderSchema.parse(body);

    let totalCents = 0;
    const tierUpdates: { tierId: string; quantity: number; priceCents: number }[] = [];

    for (const item of data.items) {
      const [tier] = await db
        .select()
        .from(ticketTiers)
        .where(and(eq(ticketTiers.id, item.tierId), eq(ticketTiers.eventId, eventId)))
        .limit(1);

      if (!tier) {
        return NextResponse.json(
          { error: `Ticket tier ${item.tierId} not found` },
          { status: 404 }
        );
      }

      if (tier.sold + item.quantity > tier.capacity) {
        return NextResponse.json(
          { error: `Not enough tickets available for ${tier.name}` },
          { status: 409 }
        );
      }

      totalCents += tier.priceCents * item.quantity;
      tierUpdates.push({ tierId: tier.id, quantity: item.quantity, priceCents: tier.priceCents });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      metadata: {
        eventId,
        userId: user.userId,
        items: JSON.stringify(data.items),
      },
    });

    const [order] = await db
      .insert(orders)
      .values({
        attendeeId: user.userId,
        eventId,
        stripePaymentIntent: paymentIntent.id,
        totalCents,
      })
      .returning();

    // Reserve capacity
    for (const upd of tierUpdates) {
      await db
        .update(ticketTiers)
        .set({ sold: sql`${ticketTiers.sold} + ${upd.quantity}` })
        .where(eq(ticketTiers.id, upd.tierId));
    }

    const totalTickets = tierUpdates.reduce((sum, u) => sum + u.quantity, 0);
    await db
      .update(events)
      .set({ ticketsSold: sql`${events.ticketsSold} + ${totalTickets}` })
      .where(eq(events.id, eventId));

    return NextResponse.json({
      order,
      clientSecret: paymentIntent.client_secret,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error }, { status: 400 });
    }
    console.error("Create order error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
