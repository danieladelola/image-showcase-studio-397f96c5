import { queryOptions } from "@tanstack/react-query";

import type { PostCategory } from "./post-types";
import { adminGetPost, adminListPosts, getPublicPost, listPublicPosts } from "./posts.functions";

export const newsListQuery = (category?: PostCategory) =>
  queryOptions({
    queryKey: ["news", "list", category ?? "all"],
    queryFn: () => listPublicPosts({ data: { category } }),
    staleTime: 60_000,
  });

export const newsPostQuery = (slug: string, preview = false) =>
  queryOptions({
    queryKey: ["news", "post", slug, preview],
    queryFn: () => getPublicPost({ data: { slug, preview } }),
    staleTime: 60_000,
  });

export const adminPostsQuery = queryOptions({ queryKey: ["admin", "posts"], queryFn: () => adminListPosts() });

export const adminPostQuery = (id: string) => queryOptions({ queryKey: ["admin", "post", id], queryFn: () => adminGetPost({ data: { id } }) });
