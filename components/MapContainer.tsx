export function MapContainer() {
  return (
    <section className="brand-surface-strong mx-auto flex min-h-[340px] w-full max-w-4xl flex-col items-center justify-center border border-dashed border-[#cdbbe6] px-6 py-10 text-center sm:min-h-[420px] sm:px-10">
      <div className="mb-4 inline-flex items-center rounded-full border border-[#eadff5] bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8c72b4]">
        Placeholder
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-[#241735] sm:text-3xl">
        Map will be rendered here
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[#6d6282] sm:text-base">
        This section will be connected to the mapping system soon.
      </p>
      <div className="mt-8 grid h-full w-full place-items-center rounded-[24px] border border-dashed border-[#d8caeb] bg-[linear-gradient(135deg,rgba(250,245,255,0.92),rgba(255,248,251,0.96))] px-6 py-14 text-sm font-medium text-[#7d6b95] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        Your teammate can replace this container with the real map implementation.
      </div>
    </section>
  );
}