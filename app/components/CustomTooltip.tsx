interface TooltipPayload {
  color: string;
  name: string;
  value: number;
  dataKey?: string;
}

export default function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-beige-50 dark:bg-zinc-800 border border-beige-300 dark:border-zinc-600 p-3 text-sm shadow-lg">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}:{" "}
          {typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}
          {entry.dataKey?.includes("acc") ? "%" : entry.dataKey?.includes("speed") ? " wpm" : ""}
        </p>
      ))}
    </div>
  );
}
