import { useQueryClient } from "@tanstack/react-query";

/** Inventar/savdo/bashorat/buyurtma-reja query'lari bir-biriga bog'liq — bittasi o'zgarsa hammasi qayta olinadi. */
export function useRetailInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["retail-products"] });
    qc.invalidateQueries({ queryKey: ["retail-alerts"] });
    qc.invalidateQueries({ queryKey: ["retail-forecast"] });
    qc.invalidateQueries({ queryKey: ["retail-reorder-plan"] });
  };
}
