export default function Logo({ size = 28, compact = false }: { size?: number; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="inline-flex items-center justify-center rounded-xl ring-1 ring-white/30"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 4px 14px color-mix(in srgb, var(--accent) 40%, transparent)",
        }}
      >
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12.5l4.2 4.2L19 7" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={`text-[1.05rem] font-semibold tracking-tight ${compact ? "hidden sm:inline" : ""}`}>
        Take<span className="text-accent">Your</span>Task
      </span>
    </span>
  );
}
