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
        "rounded-[10px] border px-4 py-3 text-left text-[15px] font-medium transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-card-hover",
      )}
    >
      {label}
    </button>
  );
}
