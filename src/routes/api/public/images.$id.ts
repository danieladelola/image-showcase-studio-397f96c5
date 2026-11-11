import { createFileRoute } from "@tanstack/react-router";

// Serves product photos stored in the database. Images are public catalogue content.
export const Route = createFileRoute("/api/public/images/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response("Not found", { status: 404 });
        const { withDb } = await import("@/lib/db.server");
        const rows = await withDb((sql) => sql`SELECT content_type, data FROM images WHERE id = ${params.id}`);
        const row = rows[0];
        if (!row) return new Response("Not found", { status: 404 });
        const body = row.data as Uint8Array;
        return new Response(body as BodyInit, {
          headers: {
            "content-type": String(row.content_type),
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
