import { Logo } from "@sums/ui/logo";

/** Loading state of the app chrome. Static shells pass no name, so only the mark shows. */
export function ShellSkeleton({ name }: { name?: string }) {
  return (
    <>
      <header className="top">
        <div className="tb">
          <Logo name={name} />
        </div>
      </header>
      <div className="wrap">
        <div className="h-8 w-48 animate-pulse rounded-md bg-hover" />
        <div className="mt-6 h-64 animate-pulse rounded-xl bg-panel" />
      </div>
    </>
  );
}
