export default function StatPill({
  icon,
  label,
  value,
  accent = "emerald"
}: {
  icon?: React.ReactNode
  label: string;
  value: string | number;
  accent?: "emerald" | "indigo" | "cyan";
}) {
  const colorMap = {
    emerald: "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20",
    indigo: "bg-indigo-400/10 text-indigo-300 ring-1 ring-indigo-400/20",
    cyan: "bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/20",
  } as const;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
 
      {icon ? 
      <div className="flex items-center gap-2 text-white/60">
        {icon}
        <span className="text-xs uppercase tracking-[0.16em]">{label}</span>
      </div> :
      <p className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</p>
      }
      {/* <div className="flex items-center gap-2 text-white/60">
        {icon}
        <span className="text-xs uppercase tracking-[0.16em]">{label}</span>
      </div> */}
      {/* <p className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</p> */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-2xl font-semibold text-white">{value}</p>
        {/* <span className={`rounded-full px-3 py-1 text-xs font-medium ${colorMap[accent]}`}>
          {label}
        </span> */}
      </div>
    </div>
  );
}
