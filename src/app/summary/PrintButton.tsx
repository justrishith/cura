"use client";

// Tiny client island for the print sheet: the only interactive element on /summary.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="r-ctl min-h-12 inline-flex items-center bg-moss px-6 text-sm font-semibold text-paper transition-[background-color,transform] duration-[240ms] ease-out hover:bg-mosshover active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 print:hidden"
    >
      Print
    </button>
  );
}

export default PrintButton;
