import type { Metadata } from "next";
import { HistoryView } from "@/components/views/history-view";

export const metadata: Metadata = { title: "Verlauf" };

export default function Page() {
  return <HistoryView />;
}
