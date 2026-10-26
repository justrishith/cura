// C6 — sticky crisis banner (design.md §4-C6). Not dismissible; 911 is human-press only.
export function CrisisBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      data-testid="crisis-banner"
      className="sticky top-0 z-50 bg-red-600 text-white"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-3">
        <p className="text-sm font-medium">
          Your note says this is urgent.{" "}
          <strong className="font-bold">Call 911 now</strong> — your caregiver has been
          alerted.
        </p>
        <a
          href="tel:911"
          data-testid="crisis-banner-call"
          className="min-h-12 inline-flex items-center rounded-full bg-white px-5 text-sm font-bold text-red-600 transition-colors duration-200 ease-out hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-red-600"
        >
          Call 911
        </a>
      </div>
    </div>
  );
}

export default CrisisBanner;
