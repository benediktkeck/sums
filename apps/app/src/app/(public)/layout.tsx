import { Suspense } from "react";
import { Logo } from "@sums/ui/logo";
import { RuntimeLogo } from "@/components/runtime-logo";

/** Pages outside the app (login): no plan is loaded here. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="top">
        <div className="tb">
          <Suspense fallback={<Logo />}>
            <RuntimeLogo />
          </Suspense>
        </div>
      </header>
      {children}
    </>
  );
}
