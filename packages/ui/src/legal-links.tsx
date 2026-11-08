import Link from "next/link";

export type LegalLinks = { imprintUrl: string | null; privacyUrl: string | null };

function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  // The built-in privacy page is a path; the operator's own pages are absolute URLs.
  if (href.startsWith("/")) return <Link href={href}>{children}</Link>;
  return (
    <a href={href} target="_blank" rel="noopener">
      {children}
    </a>
  );
}

/** Impressum (operator's site) and Datenschutz (operator's site or the built-in page), when available. */
export function LegalLinks({ links, className = "" }: { links: LegalLinks; className?: string }) {
  if (!links.imprintUrl && !links.privacyUrl) return null;
  return (
    <nav className={`legal-links ${className}`} aria-label="Rechtliches">
      {links.imprintUrl && <LegalLink href={links.imprintUrl}>Impressum</LegalLink>}
      {links.privacyUrl && <LegalLink href={links.privacyUrl}>Datenschutz</LegalLink>}
    </nav>
  );
}
