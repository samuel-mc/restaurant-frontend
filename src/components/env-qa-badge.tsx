import { isQa } from "@/lib/app-env";

type QaEnvBadgeProps = {
  className?: string;
  /** `inline` junto a copyright · `block` en sidebar */
  variant?: "inline" | "block";
};

/**
 * Chip visible solo cuando NEXT_PUBLIC_APP_ENV=qa (build Vercel QA).
 */
export function QaEnvBadge({
  className = "",
  variant = "inline",
}: QaEnvBadgeProps) {
  if (!isQa()) return null;

  if (variant === "block") {
    return (
      <p
        className={`rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-center text-[0.65rem] font-bold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-300 ${className}`}
        title="Entorno de calidad — no es producción"
      >
        Entorno QA
      </p>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border border-amber-500/45 bg-amber-500/15 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300 ${className}`}
      title="Entorno de calidad — no es producción"
    >
      QA
    </span>
  );
}
