import { cn } from "@/lib/utils";

type SorriaMarkProps = {
  size?: "sm" | "md" | "lg" | "hero";
  showSubtitle?: boolean;
  className?: string;
  align?: "left" | "center";
};

const titleSize: Record<NonNullable<SorriaMarkProps["size"]>, string> = {
  sm: "text-xl tracking-tight",
  md: "text-2xl tracking-tight",
  lg: "text-4xl tracking-tight",
  hero: "text-5xl sm:text-6xl tracking-[-0.03em]",
};

const subtitleSize: Record<NonNullable<SorriaMarkProps["size"]>, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  hero: "text-base sm:text-lg",
};

export function SorriaMark({
  size = "md",
  showSubtitle = false,
  className,
  align = "left",
}: SorriaMarkProps) {
  return (
    <div
      className={cn(
        "flex flex-col",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      <span
        className={cn(
          "font-[family-name:var(--font-display)] font-semibold text-[var(--brand-ink)]",
          titleSize[size],
        )}
      >
        Sorria
      </span>
      {showSubtitle ? (
        <span
          className={cn(
            "mt-1 font-medium text-[var(--text-muted)]",
            subtitleSize[size],
          )}
        >
          Gestão inteligente para consultórios
        </span>
      ) : null}
    </div>
  );
}
