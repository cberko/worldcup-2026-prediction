export function StatusBadge({ status, locked }: { status: string; locked: boolean }) {
  if (status === "FINISHED") {
    return <span className="chip bg-white/5 text-emerald-100/60">Finished</span>;
  }
  if (status === "IN_PLAY" || status === "PAUSED") {
    return (
      <span className="chip bg-rose-500/15 text-rose-300">
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-rose-400" />
        Live
      </span>
    );
  }
  if (locked) {
    return <span className="chip bg-gold-500/15 text-gold-300">🔒 Locked</span>;
  }
  return <span className="chip bg-grass-500/15 text-grass-300">Open</span>;
}
