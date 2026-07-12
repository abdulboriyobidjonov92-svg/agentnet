"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

// Katak sarlavhasi — mono yorliq + fokusda yopish tugmasi
export function CellHead({
  label,
  hint,
  active,
  onClose,
  closeLabel,
}: {
  label: string;
  hint: string;
  active: boolean;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <p className="label-mono">{label}</p>
        <AnimatePresence>
          {active && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-1 text-xs text-muted-foreground"
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      {active && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label={closeLabel}
          className="hit-target text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
