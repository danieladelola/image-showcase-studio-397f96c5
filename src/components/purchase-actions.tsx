import { useNavigate } from "@tanstack/react-router";
import { ShoppingCart, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cart } from "@/lib/cart";
import {
  STOCK_LABEL,
  discountPercent,
  hasDiscount,
  maxOrderQty,
  purchaseState,
  sellingPrice,
  stockState,
  unavailableReason,
} from "@/lib/product-rules";
import { naira, type Product } from "@/lib/shop-types";
import { cn } from "@/lib/utils";

export function addProductToCart(p: Product, quantity: number) {
  const price = sellingPrice(p);
  if (price == null) return;
  cart.add(
    {
      productId: p.id,
      slug: p.slug,
      name: p.name,
      price,
      imageUrl: p.featuredImage?.url ?? null,
      maxQty: maxOrderQty(p),
    },
    quantity,
  );
}

export function PriceBlock({ product: p, size = "md" }: { product: Product; size?: "md" | "lg" }) {
  const price = sellingPrice(p);
  const pct = discountPercent(p);
  if (price == null) {
    return (
      <p
        className={cn(
          "font-heading font-semibold text-foreground",
          size === "lg" ? "text-2xl" : "text-lg",
        )}
      >
        Price coming soon
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span
        className={cn(
          "font-heading font-semibold text-foreground",
          size === "lg" ? "text-3xl" : "text-xl",
        )}
      >
        {naira.format(price)}
      </span>
      {hasDiscount(p) && (
        <>
          <span className="text-sm text-muted-foreground line-through">
            {naira.format(p.price!)}
          </span>
          {size === "lg" && pct && (
            <span className="rounded-full bg-amber/20 px-2 py-0.5 text-xs font-extrabold text-brand-deep">
              Save {pct}%
            </span>
          )}
        </>
      )}
    </div>
  );
}

export function StockLabel({ product: p, className }: { product: Product; className?: string }) {
  const state = stockState(p);
  const lowStock = p.trackStock && p.stockQuantity > 0 && p.stockQuantity <= 5;
  return (
    <span
      className={cn(
        "shop-stock",
        state !== "in_stock" && "shop-stock-out",
        state === "out_of_stock" && "shop-stock-none",
        className,
      )}
    >
      {lowStock ? `Only ${p.stockQuantity} left` : STOCK_LABEL[state]}
    </span>
  );
}

/** Every product shows Add to Cart and Buy Now; they are disabled (with a reason) when it can't be bought yet. */
export function PurchaseActions({
  product: p,
  quantity = 1,
  layout = "card",
}: {
  product: Product;
  quantity?: number;
  layout?: "card" | "detail";
}) {
  const navigate = useNavigate();
  const canBuy = purchaseState(p) === "buy";
  // Cards are narrow on phones (2 per row) and on 4-per-row laptops, so stack the buttons there.
  const tall = layout === "detail" ? "h-13 text-base" : "h-10 px-2 text-sm sm:h-11 sm:px-3";

  return (
    <div className="grid gap-2">
      <div className={cn("grid gap-2.5", layout === "detail" ? "sm:grid-cols-2" : "grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2")}>
        <Button
          type="button"
          variant="outline"
          disabled={!canBuy}
          className={cn("min-w-0 whitespace-nowrap rounded-xl font-bold", tall)}
          onClick={() => {
            addProductToCart(p, quantity);
            toast.success(`${p.name} added to your cart`, {
              action: { label: "View cart", onClick: () => navigate({ to: "/checkout" }) },
            });
          }}
        >
          <ShoppingCart aria-hidden="true" /> Add to Cart
        </Button>
        <Button
          type="button"
          disabled={!canBuy}
          className={cn("min-w-0 whitespace-nowrap rounded-xl font-bold", tall)}
          onClick={() => navigate({ to: "/checkout", search: { buy: p.slug, qty: quantity } })}
        >
          <Zap aria-hidden="true" /> Buy Now
        </Button>
      </div>
      {!canBuy && (
        <p className="text-center text-xs font-bold text-muted-foreground">
          {unavailableReason(p)}
        </p>
      )}
    </div>
  );
}
