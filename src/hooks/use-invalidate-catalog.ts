import { useQueryClient } from "@tanstack/react-query";

/** Refreshes admin lists and the public shop after a product or category change. */
export function useInvalidateCatalog() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["admin"] }),
      qc.invalidateQueries({ queryKey: ["shop"] }),
      qc.invalidateQueries({ queryKey: ["product"] }),
    ]);
}
