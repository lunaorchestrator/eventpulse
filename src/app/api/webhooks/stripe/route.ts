import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, tickets, ticketTiers } from "@/db/schema";
import { stripe } from "@/lib/stripe";
import { signQrToken } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const paymentIntentId = paymentIntent.id;

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.stripePaymentIntent, paymentIntentId))
        .limit(1);

      if (!order) {
        console.error("Order not found for payment intent:", paymentIntentId);
        return NextResponse.json({ received: true });
      }

      if (order.status === "paid") {
        return NextResponse.json({ received: true });
      }

      await db
        .update(orders)
        .set({ status: "paid", updatedAt: new Date() })
        .where(eq(orders.id, order.id));

      // Issue tickets
      const items = JSON.parse(paymentIntent.metadata.items || "[]") as {
        tierId: string;
        quantity: number;
      }[];

      for (const item of items) {
        for (let i = 0; i < item.quantity; i++) {
          const ticketId = crypto.randomUUID();
          const qrCodeToken = signQrToken({
            ticketId,
            eventId: order.eventId,
          });

          await db.insert(tickets).values({
            id: ticketId,
            orderId: order.id,
            tierId: item.tierId,
            attendeeId: order.attendeeId,
            qrCodeToken,
          });
        }
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;

      await db
        .update(orders)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(orders.stripePaymentIntent, paymentIntent.id));
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
