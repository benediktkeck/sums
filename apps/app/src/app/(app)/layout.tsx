import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PlanLoader } from "@/components/plan-loader";
import { ShellSkeleton } from "@/components/shell-skeleton";

/** Every page that works on the plan: loads it, then shows the app chrome. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <PlanLoader>
        <AppShell>{children}</AppShell>
      </PlanLoader>
    </Suspense>
  );
}
