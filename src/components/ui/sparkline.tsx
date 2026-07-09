/**
 * Minimal inline SVG sparkline. Values are plotted left→right; the last
 * point is emphasised. Fixed 0..10 domain by default (pain scale).
 */
export function Sparkline({
  values,
  max = 10,
  height = 44,
}: {
  values: number[];
  max?: number;
  height?: number;
}) {
  if (values.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Belum ada data tren.</p>
    );
  }

  const width = 260;
  const pad = 4;
  const n = values.length;
  const stepX = n > 1 ? (width - pad * 2) / (n - 1) : 0;
  const y = (v: number) =>
    height - pad - (Math.min(v, max) / max) * (height - pad * 2);

  const points = values.map((v, i) => [pad + i * stepX, y(v)] as const);
  const path = points
    .map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`)
    .join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label={`Tren nyeri, nilai terakhir ${values[n - 1]}`}
    >
      <path
        d={path}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={4} fill="var(--accent)" />
    </svg>
  );
}
