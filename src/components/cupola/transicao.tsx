export function TelaTransicao({ frase }: { frase: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-xl text-center">
        <div className="mx-auto size-3 animate-pulse rounded-full bg-primary" />
        <p className="mt-6 text-[24px] leading-[30px] font-semibold text-foreground">{frase}</p>
      </div>
    </div>
  );
}
