import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(200),
  role: z.enum(["attendee", "organizer"]),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  capacity: z.number().int().positive(),
  coverImageUrl: z.string().url().optional(),
  ticketTiers: z
    .array(
      z.object({
        name: z.string().min(1),
        priceCents: z.number().int().min(0),
        capacity: z.number().int().positive(),
        saleStart: z.string().datetime().optional(),
        saleEnd: z.string().datetime().optional(),
      })
    )
    .min(1),
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  capacity: z.number().int().positive().optional(),
  status: z.enum(["draft", "published", "cancelled", "ended"]).optional(),
  coverImageUrl: z.string().url().optional(),
});

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        tierId: z.string().uuid(),
        quantity: z.number().int().positive().max(10),
      })
    )
    .min(1),
});
