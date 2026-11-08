import type { Metadata } from "next";
import { AccountsView } from "@/components/views/accounts-view";

export const metadata: Metadata = { title: "Sparkonten" };

export default function Page() {
  return <AccountsView />;
}
