import { cn } from "@/lib/utils";

export function SelectableButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-5 py-2.5 text-left text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-foreground bg-foreground font-semibold text-primary"
          : "border-input bg-card text-foreground hover:border-foreground",
      )}
    >
      {label}
    </button>
  );
}
