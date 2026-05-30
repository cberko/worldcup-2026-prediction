export function medal(i: number): string {
  return ["🥇", "🥈", "🥉"][i] ?? String(i + 1);
}

export type Accent = "grass" | "gold";

export function StandingsTable({
  head,
  rows,
  accent = "grass",
}: {
  head: string[];
  rows: { me: boolean; cells: (string | number)[] }[];
  accent?: Accent;
}) {
  const lastCol = head.length - 1;
  const totalColor = accent === "gold" ? "text-gold-300" : "text-grass-300";
  const meRow = accent === "gold" ? "bg-gold-500/10" : "bg-grass-500/10";
  const meTag = accent === "gold" ? "text-gold-300" : "text-grass-300";

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-emerald-100/40">
            {head.map((h, i) => (
              <th key={h} className={`px-4 py-3 font-medium ${i >= 2 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr
              key={ri}
              className={`border-b border-white/5 last:border-0 ${r.me ? meRow : ""}`}
            >
              {r.cells.map((c, ci) => (
                <td
                  key={ci}
                  className={`px-4 py-3 ${ci >= 2 ? "tnum text-right" : ""} ${
                    ci === 1 ? "font-semibold" : ""
                  } ${ci === lastCol ? `text-lg font-bold ${totalColor}` : ""} ${
                    ci === 0 ? "tnum text-emerald-100/50" : ""
                  }`}
                >
                  {c}
                  {ci === 1 && r.me && <span className={`ml-2 text-xs ${meTag}`}>(you)</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
