import { useSyncExternalStore } from "react";

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  imageUrl: string | null;
  quantity: number;
  /** Most units allowed when the line was added; checkout re-checks with live stock. */
  maxQty?: number;
};

const KEY = "ruwata-cart";
const EMPTY: CartLine[] = [];
let lines: CartLine[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(parsed)) lines = parsed.filter((l) => l && typeof l.productId === "string" && l.quantity > 0);
  } catch {
    lines = EMPTY;
  }
}

function commit(next: CartLine[]) {
  lines = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => {
  load();
  return lines;
};

export function useCart() {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export const cart = {
  add(item: Omit<CartLine, "quantity">, quantity = 1) {
    load();
    const existing = lines.find((l) => l.productId === item.productId);
    commit(
      existing
        ? lines.map((l) => (l.productId === item.productId ? { ...l, ...item, quantity: Math.min(item.maxQty ?? 99, 99, l.quantity + quantity) } : l))
        : [...lines, { ...item, quantity: Math.max(1, Math.min(item.maxQty ?? 99, 99, quantity)) }],
    );
  },
  setQuantity(productId: string, quantity: number) {
    load();
    commit(lines.map((l) => (l.productId === productId ? { ...l, quantity: Math.max(1, Math.min(l.maxQty ?? 99, 99, quantity)) } : l)));
  },
  remove(productId: string) {
    load();
    commit(lines.filter((l) => l.productId !== productId));
  },
  clear() {
    commit(EMPTY);
  },
  /** Keeps the cart in step with live product data (price, stock limit, name). */
  sync(updates: Array<Pick<CartLine, "productId" | "name" | "price" | "imageUrl" | "slug" | "maxQty">>) {
    load();
    const byId = new Map(updates.map((u) => [u.productId, u]));
    let changed = false;
    const next = lines.map((l) => {
      const u = byId.get(l.productId);
      if (!u) return l;
      const quantity = Math.max(1, Math.min(u.maxQty ?? 99, l.quantity));
      if (u.price === l.price && u.name === l.name && u.maxQty === l.maxQty && u.imageUrl === l.imageUrl && quantity === l.quantity) return l;
      changed = true;
      return { ...l, ...u, quantity };
    });
    if (changed) commit(next);
  },
};

export const cartCount = (l: CartLine[]) => l.reduce((n, x) => n + x.quantity, 0);
export const cartSubtotal = (l: CartLine[]) => l.reduce((n, x) => n + x.price * x.quantity, 0);
