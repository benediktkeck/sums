import type { Metadata } from "next";
import { PersonsView } from "@/components/views/persons-view";

export const metadata: Metadata = { title: "Personen" };

export default function Page() {
  return <PersonsView />;
}
