import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { verifyQrToken } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ qrToken: string }> }
) {
  try {
    const { qrToken } = await params;

    let decoded;
    try {
      decoded = verifyQrToken(qrToken);
    } catch {
      return NextResponse.json({ error: "Invalid or expired QR code" }, { status: 400 });
    }

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, decoded.ticketId))
      .limit(1);

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.checkedIn) {
      return NextResponse.json({
        status: "already_checked_in",
        checkedInAt: ticket.checkedInAt,
      });
    }

    const [updated] = await db
      .update(tickets)
      .set({ checkedIn: true, checkedInAt: new Date() })
      .where(and(eq(tickets.id, decoded.ticketId), eq(tickets.checkedIn, false)))
      .returning();

    if (!updated) {
      return NextResponse.json({
        status: "already_checked_in",
        message: "Ticket was checked in by another scanner",
      });
    }

    return NextResponse.json({
      status: "checked_in",
      ticketId: updated.id,
      checkedInAt: updated.checkedInAt,
    });
  } catch (error) {
    console.error("Check-in error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
