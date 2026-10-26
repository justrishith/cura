// /patient — thin server shell around the client check-in console (design.md §5-S2).
import type { Metadata } from "next";
import CheckInConsole from "@/components/patient/CheckInConsole";

export const metadata: Metadata = {
  title: "Cura — Check-in",
  description: "Voice-first daily check-in with Cura, a care companion between doctor visits.",
};

export default function PatientPage() {
  return <CheckInConsole />;
}
