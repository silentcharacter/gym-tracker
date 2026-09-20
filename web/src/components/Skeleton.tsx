/** Строка-скелетон с CSS-шиммером, без библиотек (§8 плана). Высота — как у реальной строки. */
export function Skeleton({ height = 20, width = "100%" }: { height?: number; width?: string }) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: 8,
        marginBottom: 8,
        background:
          "linear-gradient(90deg, var(--card) 25%, rgba(255,255,255,0.06) 50%, var(--card) 75%)",
        backgroundSize: "400px 100%",
        animation: "skeleton-shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}
