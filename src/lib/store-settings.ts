import { z } from "zod";

export const storeSettingsSchema = z
  .object({
    deliveryEnabled: z.boolean(),
    deliveryFee: z.number({ invalid_type_error: "Enter a delivery fee." }).min(0, "Fee can't be negative.").max(100_000_000),
    deliveryNote: z.string().trim().max(200),
    pickupEnabled: z.boolean(),
    pickupAddress: z.string().trim().max(300),
  })
  .refine((s) => s.deliveryEnabled || s.pickupEnabled, { message: "Turn on delivery, pickup or both.", path: ["deliveryEnabled"] })
  .refine((s) => !s.pickupEnabled || s.pickupAddress.length >= 5, { message: "Enter the pickup address.", path: ["pickupAddress"] });

export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export const DEFAULT_SETTINGS: StoreSettings = {
  deliveryEnabled: true,
  deliveryFee: 0,
  deliveryNote: "Delivered to your home or site.",
  pickupEnabled: false,
  pickupAddress: "",
};
