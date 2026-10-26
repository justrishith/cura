"use client";

// Tiny client island for the print sheet: the only interactive element on /summary.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-12 inline-flex items-center rounded-full bg-teal-600 px-6 text-sm font-semibold text-white transition-colors duration-200 ease-out hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 print:hidden"
    >
      Print
    </button>
  );
}

export default PrintButton;
