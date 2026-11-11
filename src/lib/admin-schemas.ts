import { z } from "zod";

import { AVAILABILITIES, PRODUCT_STATUSES } from "./shop-types";

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

export const slugField = z
  .string()
  .trim()
  .min(1, "Enter a link name.")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes only.");

const imageUrl = z.string().trim().max(500).regex(/^(\/api\/public\/images\/[0-9a-f-]{36}|https:\/\/\S+)$/, "Invalid image.");
export const imageSchema = z.object({ url: imageUrl, alt: z.string().trim().max(200) });

const money = (label: string) =>
  z.number({ invalid_type_error: `Enter ${label}.` }).min(0, "Amount can't be negative.").max(1_000_000_000, "That amount is too large.");

const specText = z.string().trim().max(300).optional();

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a product name.").max(140),
    slug: slugField,
    sku: z
      .string()
      .trim()
      .max(60)
      .regex(/^[A-Za-z0-9._-]*$/, "Use letters, numbers, dots and dashes only.")
      .transform((v) => (v ? v.toUpperCase() : null))
      .nullable(),
    categoryId: z.string().uuid().nullable(),
    shortDescription: z.string().trim().max(300).default(""),
    description: z.string().trim().max(5000).default(""),
    // Legacy flag: quote-only products no longer exist, so it is always saved as false.
    quoteOnly: z.boolean().optional().transform(() => false),
    price: money("a regular price").nullable(),
    salePrice: money("a sale price").nullable(),
    installationFee: money("an installation fee").nullable(),
    featuredImage: imageSchema.nullable(),
    gallery: z.array(imageSchema).max(12, "Add up to 12 gallery images."),
    features: z
      .array(z.object({ icon: z.string().max(30), label: z.string().trim().min(1, "Enter a feature name.").max(60), value: z.string().trim().min(1, "Enter a feature detail.").max(160) }))
      .max(12),
    specs: z.object({
      capacityKva: specText,
      panelWattage: specText,
      batteryCapacity: specText,
      batteryChemistry: specText,
      inverterType: specText,
      includedComponents: specText,
      warranty: specText,
      installationIncluded: z.boolean().optional(),
    }),
    badge: z.string().trim().max(30).nullable(),
    trackStock: z.boolean(),
    stockQuantity: z.number({ invalid_type_error: "Enter a stock quantity." }).int("Use a whole number.").min(0, "Stock can't be negative.").max(1_000_000),
    availability: z.enum(AVAILABILITIES),
    isFeatured: z.boolean(),
    status: z.enum(PRODUCT_STATUSES),
    sortOrder: z.number().int().min(0).max(10000),
  })
  .superRefine((p, ctx) => {
    if (p.price == null) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a regular price. Every product is sold with Add to Cart and Buy Now." });
    }
    if (p.salePrice != null && (p.price == null || p.salePrice >= p.price)) {
      ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Sale price must be lower than the regular price." });
    }
  });
export type ProductInput = z.input<typeof productInputSchema>;
export type ProductOutput = z.output<typeof productInputSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(80),
  slug: slugField,
  description: z.string().trim().max(300).default(""),
  sortOrder: z.number().int().min(0).max(10000),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const FULFILMENT_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "installed", "cancelled"] as const;
export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];
export const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "failed", "cancelled", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FULFILMENT_LABEL: Record<FulfilmentStatus, string> = {
  pending: "New",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Out for delivery",
  delivered: "Delivered",
  installed: "Installed",
  cancelled: "Cancelled",
};
export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  pending: "Awaiting payment",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Not completed",
  refunded: "Refunded",
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
