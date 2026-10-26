import type { Metadata } from "next";
import { Instrument_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Organic typography: Source Serif 4 for statements/headings (--font-display),
// Instrument Sans for reading and controls. next/font self-hosts both, so the
// Vercel build needs no runtime fetch.
const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const sans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "cura — Care between visits.",
  description:
    "Daily voice check-ins at home. When something's off, Cura makes the phone calls that matter — and the family watches it live.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
