/**
 * CustomTooltip — recharts tooltip rendered inside a styled box.
 *
 * Recharts injects `active`, `payload`, and `label` automatically
 * when the `<Tooltip>` component receives a `content` prop.
 */
export default function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-beige-50 dark:bg-zinc-800 border border-beige-300 dark:border-zinc-600 p-3 text-sm shadow-lg">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}:{" "}
          {typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}
          {entry.dataKey?.includes("acc") ? "%" : entry.dataKey?.includes("speed") ? " wpm" : ""}
        </p>
      ))}
    </div>
  );
}
