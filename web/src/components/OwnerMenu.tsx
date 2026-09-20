import { useState } from "react";
import { Sheet, SheetButton } from "./Sheet";

/**
 * «···» в шапке «Тренировок» (только владелец). Единственный пункт на этом этапе —
 * «Порядок групп»; остальные пункты §8 (инициализация, экспорт) — в более поздних этапах
 * (spec/stage-3-polish.md, «Что не входит»).
 */
export function OwnerMenu({ onOpenGroupOrder }: { onOpenGroupOrder: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ background: "transparent", border: "none", color: "var(--text)", fontSize: 20 }}
      >
        ···
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <SheetButton
            onClick={() => {
              setOpen(false);
              onOpenGroupOrder();
            }}
          >
            Порядок групп
          </SheetButton>
        </Sheet>
      )}
    </>
  );
}
