"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  CircleAlert,
  Compass,
  Ellipsis,
  Eye,
  Fuel,
  History,
  House,
  Landmark,
  LogOut,
  Moon,
  PiggyBank,
  Receipt,
  Redo2,
  Settings,
  Sun,
  Undo2,
  Wallet,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NEW_ITEM_EVENT } from "@/lib/events";
import { useAppConfig } from "./backend-context";
import { previewPage } from "@/lib/preview";
import { track } from "@/lib/analytics/client";
import { Logo } from "@sums/ui/logo";
import { DemoBanner, SetupBar, showGuide } from "./onboarding/setup-guide";
import { usePlan } from "./plan-provider";
import { SwitchDialog } from "./switch-dialog";
import { Tip } from "./ui-bits";
import { UiContext, useUi } from "./ui-context";
import { PreviewBar, PreviewView } from "./views/preview-view";

export { useUi } from "./ui-context";

const NAV_ICONS_KEY = "sums:nav-icons";

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { undo, redo } = usePlan();
  const [switchEdit, setSwitchEdit] = useState<{ id: string | null } | null>(null);
  const editSwitch = useCallback((id: string | null) => setSwitchEdit({ id }), []);
  const [navIcons, setNavIconsState] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a client-only preference after hydration
    if (localStorage.getItem(NAV_ICONS_KEY) === "off") setNavIconsState(false);
  }, []);
  const setNavIcons = useCallback((on: boolean) => {
    setNavIconsState(on);
    localStorage.setItem(NAV_ICONS_KEY, on ? "on" : "off");
  }, []);
  const pathname = usePathname();
  const router = useRouter();
  // Tabs inside the preview are plain state, so switching needs no navigation or server round trip.
  // The URL stays on `from`; if it changes anyway (browser back), the preview ends.
  const [preview, setPreview] = useState<{ from: string; href: string } | null>(null);
  const canPreview = !!previewPage(pathname);
  const previewHref = preview?.from === pathname ? preview.href : null;
  const previewing = previewHref !== null;
  const openPreview = useCallback(() => {
    track("preview_opened", { page: pathname });
    setPreview({ from: pathname, href: pathname });
  }, [pathname]);
  const exitPreview = useCallback(() => {
    // One transition: the preview stays up until the page of the current tab is ready.
    startTransition(() => {
      if (previewHref && previewHref !== pathname) router.push(previewHref);
      setPreview(null);
    });
  }, [previewHref, pathname, router]);
  const selectPreview = useCallback(
    (href: string) => {
      setPreview({ from: pathname, href });
      window.scrollTo(0, 0);
    },
    [pathname],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (previewing) {
        // Read-only: Esc leaves, and nothing may change data the user can't see being changed.
        if (e.key === "Escape") exitPreview();
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      const dialogOpen = !!document.querySelector('[role="dialog"]');
      if (mod && !e.altKey && (e.key === "z" || e.key === "Z" || e.key === "y")) {
        if (isEditable(e.target) || dialogOpen) return; // native text undo inside fields
        e.preventDefault();
        if (e.key === "y" || e.shiftKey) void redo();
        else void undo();
        return;
      }
      if (!mod && !e.altKey && (e.key === "n" || e.key === "N") && !isEditable(e.target) && !dialogOpen) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(NEW_ITEM_EVENT));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, previewing, exitPreview]);

  return (
    <UiContext.Provider value={{ editSwitch, navIcons, setNavIcons, openPreview: canPreview ? openPreview : undefined }}>
      <TooltipProvider delayDuration={250}>
        {previewing ? (
          <>
            <PreviewBar href={previewHref} onSelect={selectPreview} onExit={exitPreview} />
            <PreviewView href={previewHref} />
          </>
        ) : (
          <>
            <TopBar onPreview={canPreview ? openPreview : undefined} />
            <DemoBanner />
            <SetupBar />
            {children}
            <MobileNav />
          </>
        )}
        {switchEdit && <SwitchDialog switchId={switchEdit.id} onClose={() => setSwitchEdit(null)} />}
      </TooltipProvider>
    </UiContext.Provider>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Tip content="Hell / Dunkel" side="bottom">
      <button
        className="btn ghost ibtn only-m"
        aria-label="Farbschema wechseln"
        onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      >
        <Sun className="hidden [[data-theme=dark]_&]:block" />
        <Moon className="hidden [[data-theme=light]_&]:block" />
      </button>
    </Tip>
  );
}

const MORE_LINKS = [
  { href: "/verlauf", label: "Verlauf", icon: History },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
];

/** Ends the password session (only shown when SUMS_PASSWORD is set). */
function logout() {
  // A real form post: the response redirects to /login with a full page load, dropping all client state.
  const form = document.createElement("form");
  form.method = "post";
  form.action = "/api/logout";
  document.body.append(form);
  form.submit();
}

/** Everything that isn't a budget page, labeled and in one place. */
function MoreMenu() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const light = resolvedTheme === "light";
  const current = MORE_LINKS.find((l) => isActive(pathname, l.href));
  const { auth } = useAppConfig();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`btn ghost hide-m ${current ? "is-active" : ""}`}>
          {current ? <current.icon /> : <Ellipsis />}
          {current?.label ?? "Mehr"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {MORE_LINKS.map((l) => (
          <DropdownMenuItem key={l.href} asChild>
            <Link href={l.href}>
              <l.icon /> {l.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild>
          <Link href="/uebersicht" onClick={showGuide}>
            <Compass /> Erste Schritte
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setTheme(light ? "dark" : "light")}>
          {light ? <Moon /> : <Sun />} {light ? "Dunkles Design" : "Helles Design"}
        </DropdownMenuItem>
        {auth && (
          <DropdownMenuItem onSelect={logout}>
            <LogOut /> Abmelden
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Undo/redo. Edits save on their own, so the save state only shows up when that failed. */
function VersionControls() {
  const { saveStatus, canUndo, canRedo, undo, redo, busy, flush } = usePlan();
  return (
    <div className="vgroup hide-m">
      {saveStatus === "error" && (
        <>
          <Tip side="bottom" content="Klicken, um es erneut zu versuchen">
            <button className="vstate error" role="alert" onClick={() => void flush()}>
              <CircleAlert size={15} />
              Nicht gespeichert
            </button>
          </Tip>
          <span className="vsep" />
        </>
      )}
      <Tip content="Rückgängig · Strg+Z" side="bottom">
        <button className="vbtn" onClick={() => void undo()} disabled={!canUndo || busy} aria-label="Rückgängig">
          <Undo2 size={17} />
        </button>
      </Tip>
      <Tip content="Wiederholen · Strg+Umschalt+Z" side="bottom">
        <button className="vbtn" onClick={() => void redo()} disabled={!canRedo || busy} aria-label="Wiederholen">
          <Redo2 size={17} />
        </button>
      </Tip>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  return pathname.startsWith(href);
}

function TopBar({ onPreview }: { onPreview?: () => void }) {
  const pathname = usePathname();
  const { canUndo, undo, busy } = usePlan();
  const { navIcons } = useUi();
  const { name } = useAppConfig();
  const nav = [
    { href: "/uebersicht", label: "Übersicht", icon: House },
    { href: "/fixkosten", label: "Fixkosten", icon: Receipt },
    { href: "/einkommen", label: "Einkommen", icon: Wallet },
    { href: "/variable", label: "Variable Kosten", icon: Fuel },
    { href: "/ruecklagen", label: "Rücklagen", icon: PiggyBank },
    { href: "/sparkonten", label: "Sparkonten", icon: Landmark },
  ];
  return (
    <header className="top">
      <div className="tb">
        <Logo name={name} />
        <nav className="nav hide-m" aria-label="Bereiche">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={isActive(pathname, n.href) ? "a" : ""}>
              {navIcons && <n.icon size={16} className="nav-ico" />}
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="sp" />
        <VersionControls />
        {onPreview && (
          <Tip content="Nur die Zahlen, ohne Bedienelemente" side="bottom">
            <button className="btn ghost" onClick={onPreview} aria-label="Vorschau">
              <Eye />
              <span className="hide-m tb-collapse">Vorschau</span>
            </button>
          </Tip>
        )}
        <MoreMenu />
        <button className="btn ghost ibtn only-m" onClick={() => void undo()} disabled={!canUndo || busy} aria-label="Rückgängig">
          <Undo2 />
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { canRedo, redo, busy } = usePlan();
  const { auth } = useAppConfig();
  const tabs = [
    { href: "/uebersicht", label: "Übersicht", icon: House },
    { href: "/fixkosten", label: "Fixkosten", icon: Receipt },
    { href: "/einkommen", label: "Einkommen", icon: Wallet },
    { href: "/ruecklagen", label: "Rücklagen", icon: PiggyBank },
  ];
  const more = [
    { href: "/variable", label: "Variable Kosten", icon: Fuel },
    { href: "/sparkonten", label: "Sparkonten", icon: Landmark },
    { href: "/einstellungen", label: "Einstellungen", icon: Settings },
    { href: "/verlauf", label: "Verlauf & Speicherstände", icon: History },
  ];
  const moreActive = more.some((m) => isActive(pathname, m.href));
  return (
    <>
      <nav className="mnav" aria-label="Bereiche">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={isActive(pathname, t.href) ? "a" : ""}>
            <t.icon size={20} />
            {t.label}
          </Link>
        ))}
        <button className={moreActive ? "a" : ""} onClick={() => setOpen(true)}>
          <Ellipsis size={20} />
          Mehr
        </button>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl border-line-2 bg-panel pb-[calc(2rem+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Mehr</SheetTitle>
          </SheetHeader>
          <div className="px-2">
            {more.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                onClick={() => setOpen(false)}
                className={`flex h-12 items-center gap-3 rounded-lg px-3 font-medium hover:bg-hover ${isActive(pathname, m.href) ? "text-brand" : ""}`}
              >
                <m.icon size={18} />
                {m.label}
              </Link>
            ))}
            <Link
              href="/uebersicht"
              onClick={() => {
                showGuide();
                setOpen(false);
              }}
              className="flex h-12 items-center gap-3 rounded-lg px-3 font-medium hover:bg-hover"
            >
              <Compass size={18} /> Erste Schritte
            </Link>
            <button
              className="flex h-12 w-full items-center gap-3 rounded-lg px-3 font-medium hover:bg-hover disabled:opacity-40"
              disabled={!canRedo || busy}
              onClick={() => void redo()}
            >
              <Redo2 size={18} /> Wiederholen
            </button>
            {auth && (
              <button className="flex h-12 w-full items-center gap-3 rounded-lg px-3 font-medium hover:bg-hover" onClick={logout}>
                <LogOut size={18} /> Abmelden
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
