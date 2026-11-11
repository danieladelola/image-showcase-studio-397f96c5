import { queryOptions } from "@tanstack/react-query";

import { getProduct, listShop } from "./shop.functions";

export const shopQuery = queryOptions({
  queryKey: ["shop"],
  queryFn: () => listShop(),
  staleTime: 60_000,
});

export const productQuery = (slug: string, preview = false) =>
  queryOptions({
    queryKey: ["product", slug, preview],
    queryFn: () => getProduct({ data: { slug, preview } }),
    staleTime: 60_000,
  });
