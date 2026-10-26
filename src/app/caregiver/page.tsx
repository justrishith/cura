// /caregiver — server wrapper for the caregiver dashboard (design.md §S3).
import type { Metadata } from "next";
import { DashboardClient } from "@/components/caregiver/DashboardClient";

export const metadata: Metadata = {
  title: "Caregiver dashboard — cura",
  description:
    "Watch Maria's check-ins, alerts, medications, and the calls Cura makes — live.",
};

export default function CaregiverPage() {
  return <DashboardClient />;
}
