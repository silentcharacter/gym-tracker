import "chartjs-adapter-date-fns"; // побочный эффект: регистрирует адаптер дат для type: 'time'
import {
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  TimeScale,
  Tooltip,
} from "chart.js";
import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import { epley } from "../lib/oneRepMax";
import { readThemeColor } from "../lib/theme";
import { onThemeChanged } from "../telegram";
import type { WeightLogDoc } from "../types";
import { EmptyState } from "./EmptyState";

// Регистрируем только нужные элементы, а не chart.js/auto — не тащить в бандл все типы графиков
// ради одного line chart (spec/stage-3-polish.md, решение 1).
ChartJS.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler);

type Mode = "weight" | "onerm";

export function WeightChart({ logs }: { logs: WeightLogDoc[] }) {
  const [mode, setMode] = useState<Mode>("weight");
  // Chart.js не перечитывает CSS-переменные сам — при смене темы форсируем remount графика
  // с заново прочитанными цветами (canvas не понимает var(...), см. lib/theme.ts).
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => onThemeChanged(() => setThemeVersion((v) => v + 1)), []);

  const hasReps = logs.some((l) => l.reps != null);

  const { data, options } = useMemo(() => {
    const accent = readThemeColor("--accent", "#5288c1");
    const hint = readThemeColor("--hint", "#708499");
    const text = readThemeColor("--text", "#f5f5f5");

    const points = logs.map((l) => ({
      x: Date.parse(l.date),
      y: mode === "weight" ? l.weight : epley(l.weight, l.reps),
    }));

    return {
      data: {
        datasets: [
          {
            data: points,
            borderColor: accent,
            backgroundColor: accent,
            pointBackgroundColor: accent,
            pointRadius: points.length === 1 ? 4 : 3,
            showLine: points.length > 1,
            tension: 0.2,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false as const,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: {
          x: {
            type: "time" as const,
            time: { unit: "month" as const, tooltipFormat: "d MMM yyyy" },
            ticks: { color: hint },
            grid: { display: false },
          },
          y: {
            beginAtZero: false,
            ticks: { color: hint },
            grid: { color: "rgba(255,255,255,0.06)" },
          },
        },
        color: text,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    };
    // themeVersion форсирует пересчёт цветов из getComputedStyle при смене темы
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, mode, themeVersion]);

  if (logs.length === 0) {
    return (
      <div style={{ height: 180, borderRadius: 14, background: "var(--card)" }}>
        <EmptyState>Пока нет записей</EmptyState>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--card)", borderRadius: 14, padding: 16 }}>
      {hasReps && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <ModeButton active={mode === "weight"} onClick={() => setMode("weight")}>
            Вес
          </ModeButton>
          <ModeButton active={mode === "onerm"} onClick={() => setMode("onerm")}>
            1ПМ
          </ModeButton>
        </div>
      )}
      <div style={{ height: 180 }}>
        <Line key={themeVersion} data={data} options={options} />
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 12px",
        borderRadius: 999,
        border: "none",
        background: active ? "var(--accent)" : "var(--bg)",
        color: active ? "var(--accent-text)" : "var(--hint)",
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}
