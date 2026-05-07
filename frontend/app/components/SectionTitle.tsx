export default function SectionTitle({
  icon,
  title,
  align = "left",
  subtitle
}: {
  icon: React.ReactNode;
  title: string;
  align?: "left" | "center";
  subtitle?: string
}) {
  return (
    <div
      className={[
        "mb-4 flex items-center gap-2",
        align === "center" ? "justify-center text-center" : "justify-start",
      ].join(" ")}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-white/90">
        {icon}
      </span>
      <div>
        <h2 className="text-xl font-semibold text-white md:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
      </div>
    </div>
  );
}