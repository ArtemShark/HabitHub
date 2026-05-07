import Link from "next/link";
import { motion } from "framer-motion";

export default function NavButton({ href, label, active = false }: { href: string; label: string; active?: boolean }) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -2, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={[
          "group relative overflow-hidden rounded-2xl border px-5 py-2.5 text-sm font-medium backdrop-blur-md transition md:text-base",
          active
            ? "border-emerald-400/70 bg-emerald-400/10 text-white shadow-[0_0_24px_rgba(16,185,129,0.18)]"
            : "border-white/15 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10 hover:text-white",
        ].join(" ")}
      >
        <span className="relative z-10">{label}</span>
        {active && <span className="absolute inset-x-4 bottom-1 h-[2px] rounded-full bg-emerald-400" />}
      </motion.div>
    </Link>
  );
}