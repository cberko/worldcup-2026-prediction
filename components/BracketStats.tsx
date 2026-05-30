export type StageStat = {
  label: string;
  points: number; // points earned this round
  correct: number; // correct advancing picks
  decided: number; // matches in this round already played
  total: number; // matches in this round
};

const MAX = 32; // every knockout round caps at 32 (count × per-pick value)

export function BracketStats({ stats, total }: { stats: StageStat[]; total: number }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="display text-lg">Your points by round</h3>
        <span className="chip bg-gold-500/20 text-gold-300">{total} pts</span>
      </div>
      <div className="space-y-2.5">
        {stats.map((s) => {
          const pct = Math.round((s.points / MAX) * 100);
          return (
            <div key={s.label} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-emerald-100/60">
                {s.label}
              </span>
              <div className="relative h-5 flex-1 overflow-hidden rounded-md border border-white/5 bg-pitch-950/50">
                <div
                  className="h-full rounded-md bg-gradient-to-r from-gold-500/70 to-gold-400/90 transition-all"
                  style={{ width: `${pct}%` }}
                />
                <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-medium text-emerald-100/40">
                  / {MAX}
                </span>
              </div>
              <span className="tnum w-10 shrink-0 text-right text-sm font-bold text-gold-300">
                {s.points}
              </span>
              <span className="tnum w-12 shrink-0 text-right text-[11px] text-emerald-100/45">
                {s.correct}/{s.decided || s.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
