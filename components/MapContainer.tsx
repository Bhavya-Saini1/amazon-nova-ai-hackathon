export function MapContainer() {
  return (
    <section className="brand-glass-surface mx-auto flex min-h-[340px] w-full max-w-4xl flex-col items-center justify-center border border-dashed border-white/14 px-6 py-10 text-center sm:min-h-[420px] sm:px-10">
      <div className="brand-page-pill mb-4 inline-flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]">
        Placeholder
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Map will be rendered here
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[#d8cfee] sm:text-base">
        This section will be connected to the mapping system soon.
      </p>
      <div className="brand-glass-panel mt-8 grid h-full w-full place-items-center border border-dashed border-white/14 px-6 py-14 text-sm font-medium text-[#d8cfee] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
        Your teammate can replace this container with the real map implementation.
      </div>
    </section>
  );
}