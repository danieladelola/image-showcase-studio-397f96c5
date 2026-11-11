import { z } from "zod";

import { MAX_QTY_PER_LINE } from "./product-rules";

export const lineSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE) });
export const linesSchema = z.array(lineSchema).min(1, "Your cart is empty.").max(50);

export const customerSchema = z.object({
  customerName: z.string().trim().min(2, "Enter your full name.").max(100),
  email: z.string().trim().email("Enter a valid email address.").max(255),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number.")
    .max(30)
    .regex(/^[+\d][\d\s()-]{6,}$/, "Enter a valid phone number."),
  address: z.string().trim().min(5, "Enter your delivery address.").max(300),
  city: z.string().trim().min(2, "Enter your city.").max(80),
  state: z.string().trim().min(2, "Enter your state.").max(80),
  notes: z.string().trim().max(1000).optional().default(""),
});
export type CustomerInput = z.input<typeof customerSchema>;

export const optionsSchema = z.object({
  deliveryMethod: z.enum(["delivery", "pickup"]),
  installation: z.boolean(),
});

export const quoteSchema = z.object({ items: linesSchema, options: optionsSchema });
export const checkoutSchema = customerSchema.extend({ items: linesSchema, options: optionsSchema });
export type CheckoutInput = z.infer<typeof checkoutSchema>;
