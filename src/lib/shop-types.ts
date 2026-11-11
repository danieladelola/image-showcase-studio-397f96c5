export type ProductFeature = { icon: string; label: string; value: string };
export type ProductImage = { url: string; alt: string };

export const PRODUCT_STATUSES = ["draft", "published", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const AVAILABILITIES = ["in_stock", "out_of_stock", "preorder"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export type ProductSpecs = {
  capacityKva?: string;
  panelWattage?: string;
  batteryCapacity?: string;
  batteryChemistry?: string;
  inverterType?: string;
  includedComponents?: string;
  installationIncluded?: boolean;
  warranty?: string;
};

export const SPEC_FIELDS = [
  { key: "capacityKva", label: "System capacity", placeholder: "e.g. 2.5 kVA" },
  { key: "panelWattage", label: "Panel wattage", placeholder: "e.g. 4 × 450W mono" },
  { key: "batteryCapacity", label: "Battery capacity", placeholder: "e.g. 5 kWh" },
  { key: "batteryChemistry", label: "Battery chemistry", placeholder: "e.g. Lithium (LiFePO4)" },
  { key: "inverterType", label: "Inverter type", placeholder: "e.g. Hybrid pure sine wave" },
  { key: "includedComponents", label: "Included components", placeholder: "e.g. Panels, inverter, battery, cables, mounting" },
  { key: "warranty", label: "Warranty", placeholder: "Only verified warranty terms" },
] as const satisfies ReadonlyArray<{ key: Exclude<keyof ProductSpecs, "installationIncluded">; label: string; placeholder: string }>;

export type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  shortDescription: string;
  description: string;
  /** Regular price in naira; null when the price isn't confirmed. */
  price: number | null;
  salePrice: number | null;
  quoteOnly: boolean;
  featuredImage: ProductImage | null;
  gallery: ProductImage[];
  features: ProductFeature[];
  specs: ProductSpecs;
  installationFee: number | null;
  badge: string | null;
  status: ProductStatus;
  isFeatured: boolean;
  trackStock: boolean;
  stockQuantity: number;
  availability: Availability;
  sortOrder: number;
  updatedAt: string;
};

export type AdminProduct = Product & { hasOrders: boolean };

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  productCount: number;
};

export const FEATURE_ICONS = [
  { key: "battery", label: "Battery" },
  { key: "inverter", label: "Inverter" },
  { key: "charging", label: "Charging" },
  { key: "panel", label: "Solar panel" },
  { key: "paygo", label: "Payment" },
  { key: "warranty", label: "Warranty" },
  { key: "wifi", label: "Monitoring" },
  { key: "gauge", label: "Performance" },
  { key: "shield", label: "Protection" },
  { key: "delivery", label: "Delivery" },
] as const;

export const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
