import type { Metadata } from "next";
import { OverviewView } from "@/components/views/overview-view";

export const metadata: Metadata = { title: "Übersicht" };

export default function Page() {
  return <OverviewView />;
}
