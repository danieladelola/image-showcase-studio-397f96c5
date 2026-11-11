import { queryOptions } from "@tanstack/react-query";

import { getAdminStatus } from "./admin-auth.functions";
import {
  adminGetOrder,
  adminGetProduct,
  adminGetSettings,
  adminListCategories,
  adminListOrders,
  adminListProducts,
  getDashboard,
} from "./admin.functions";

export type DashboardRange = { from: string; to: string; groupBy: "day" | "week" | "month" };

export const adminStatusQuery = queryOptions({
  queryKey: ["admin", "status"],
  queryFn: () => getAdminStatus(),
  staleTime: 60_000,
});

export const dashboardQuery = (range: DashboardRange) =>
  queryOptions({ queryKey: ["admin", "dashboard", range], queryFn: () => getDashboard({ data: range }) });

export const adminProductsQuery = queryOptions({ queryKey: ["admin", "products"], queryFn: () => adminListProducts() });

export const adminProductQuery = (id: string) =>
  queryOptions({ queryKey: ["admin", "product", id], queryFn: () => adminGetProduct({ data: { id } }) });

export const adminCategoriesQuery = queryOptions({ queryKey: ["admin", "categories"], queryFn: () => adminListCategories() });

export const adminOrdersQuery = queryOptions({ queryKey: ["admin", "orders"], queryFn: () => adminListOrders() });

export const adminOrderQuery = (id: string) =>
  queryOptions({ queryKey: ["admin", "order", id], queryFn: () => adminGetOrder({ data: { id } }) });

export const adminSettingsQuery = queryOptions({ queryKey: ["admin", "settings"], queryFn: () => adminGetSettings() });

/** Calendar date (YYYY-MM-DD) in Lagos time. */
export function lagosDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function daysAgo(n: number, from = new Date()) {
  return lagosDate(new Date(from.getTime() - n * 86_400_000));
}
