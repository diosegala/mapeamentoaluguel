export function TelaTransicao({ frase }: { frase: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-background px-6">
      <div className="max-w-xl text-center">
        <img src="/brand/cupola-simbolo.png" alt="" className="mx-auto size-12 animate-pulse" />
        <p className="mt-8 text-[24px] leading-[32px] font-semibold text-foreground-on-dark">{frase}</p>
      </div>
    </div>
  );
}
