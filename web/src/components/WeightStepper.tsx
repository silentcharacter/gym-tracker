import { formatWeight } from "../lib/format";
import { impactLight } from "../lib/haptics";

const STEP = 2.5;

/**
 * −2.5 · <вес> · +2.5 (мокап §8). Считает в шагах по 0.5 от целого числа шагов, а не
 * накапливает `+= 2.5` — иначе плавающая точка даёт мусор вроде 87.50000000000001
 * (см. spec/stage-2-weights.md, риски).
 */
export function WeightStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  function step(delta: number) {
    impactLight();
    const steps = Math.round(value / 0.5) + Math.round(delta / 0.5);
    onChange(Math.max(0, steps) * 0.5);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <StepButton label={`−${STEP}`} onClick={() => step(-STEP)} />
      <div style={{ fontSize: 28, fontWeight: 700 }}>
        {formatWeight(value)} <span style={{ fontSize: 16, color: "var(--hint)" }}>кг</span>
      </div>
      <StepButton label={`+${STEP}`} onClick={() => step(STEP)} />
    </div>
  );
}

function StepButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 56,
        height: 44,
        borderRadius: 10,
        border: "none",
        background: "var(--bg)",
        color: "var(--text)",
        fontSize: 16,
      }}
    >
      {label}
    </button>
  );
}
