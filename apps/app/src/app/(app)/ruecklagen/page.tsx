import type { Metadata } from "next";
import { SavingsView } from "@/components/views/savings-view";

export const metadata: Metadata = { title: "Rücklagen" };

export default function Page() {
  return <SavingsView />;
}
