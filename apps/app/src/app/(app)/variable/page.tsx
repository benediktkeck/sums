import type { Metadata } from "next";
import { VariableView } from "@/components/views/variable-view";

export const metadata: Metadata = { title: "Variable Kosten" };

export default function Page() {
  return <VariableView />;
}
