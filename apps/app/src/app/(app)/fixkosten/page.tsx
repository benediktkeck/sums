import type { Metadata } from "next";
import { ExpensesView } from "@/components/views/expenses-view";

export const metadata: Metadata = { title: "Fixkosten" };

export default function Page() {
  return <ExpensesView />;
}
