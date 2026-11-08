import type { Metadata } from "next";
import { CarsView } from "@/components/views/cars-view";

export const metadata: Metadata = { title: "Autos" };

export default function Page() {
  return <CarsView />;
}
