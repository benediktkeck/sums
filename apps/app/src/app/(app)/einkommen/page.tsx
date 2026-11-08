import type { Metadata } from "next";
import { IncomeView } from "@/components/views/income-view";

export const metadata: Metadata = { title: "Einkommen" };

export default function Page() {
  return <IncomeView />;
}
