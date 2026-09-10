import { Input } from "@/components/ui/input";

function formatBRL(digits: string) {
  const cents = Number(digits || "0");
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "R$ 0,00",
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
}) {
  const display = value == null ? "" : formatBRL(String(Math.round(value * 100)));

  return (
    <Input
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "");
        onChange(digits ? Number(digits) / 100 : null);
      }}
    />
  );
}
