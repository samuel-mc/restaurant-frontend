/**
 * Revisión antes/después para confirmaciones de alto impacto (SuperAdmin).
 */

export type MutationReviewRow = {
  label: string;
  from: string;
  to: string;
};

export function MutationReviewDetail({
  rows,
  note,
}: {
  rows: MutationReviewRow[];
  note?: string;
}) {
  if (rows.length === 0 && !note) return null;

  const hasRows = rows.length > 0;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-3">
      {hasRows ? (
        <>
          <p className="text-xs font-medium text-zinc-400">Revisión</p>
          <dl className="mt-2 space-y-2.5">
            {rows.map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-xs text-zinc-400">{row.label}</dt>
                <dd className="mt-0.5 break-words text-sm text-zinc-200">
                  <span className="text-zinc-400">{row.from}</span>
                  <span className="mx-1.5 text-zinc-500" aria-hidden>
                    →
                  </span>
                  <span className="font-medium text-white">{row.to}</span>
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
      {note ? (
        <p
          className={`break-words font-mono text-xs text-zinc-400 ${
            hasRows ? "mt-2" : ""
          }`}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
