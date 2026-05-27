import type { ReactNode } from "react";

const ARTICLE_URL =
  "https://rifqi-tjahyono.com/%f0%9f%9a%80-country-analytics-sidekick-country-analysis-pestel-porters-without-the-spreadsheet-sweat-%f0%9f%92%bc%e2%9c%a8/";
const GITHUB_URL = "https://github.com/RifqiMT/country-analytics-platform";
const LINKEDIN_URL = "https://www.linkedin.com";
const WEBSITE_URL = "https://rifqi-tjahyono.com";

function FooterLink({
  href,
  children,
  ariaLabel,
  className = "",
}: {
  href: string;
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={ariaLabel}
      className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium text-slate-600 transition hover:text-red-600 ${className}`}
    >
      {children}
    </a>
  );
}

function IconFooterLink({
  href,
  ariaLabel,
  children,
}: {
  href: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <FooterLink href={href} ariaLabel={ariaLabel} className="text-slate-500 hover:text-red-600">
      {children}
    </FooterLink>
  );
}

function ArticleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v6a2 2 0 002 2h2M15 11h4.945M15 11V9a2 2 0 00-2-2h-2M9 11V9a2 2 0 012-2h2m-6 4v6a2 2 0 002 2h2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200/90 bg-white pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-x-3 px-3 py-3 sm:px-4 lg:px-6 xl:px-8">
        <p className="min-w-0 text-xs leading-snug text-slate-500 sm:truncate">
          © {year} Created, and maintained by{" "}
          <FooterLink href={WEBSITE_URL} ariaLabel="Rifqi Tjahyono website" className="inline text-slate-700">
            Rifqi Tjahyono
          </FooterLink>
        </p>

        <nav className="flex shrink-0 items-center gap-3" aria-label="Footer links">
          <IconFooterLink href={ARTICLE_URL} ariaLabel="Project article">
            <ArticleIcon />
          </IconFooterLink>
          <IconFooterLink href={GITHUB_URL} ariaLabel="GitHub repository">
            <GitHubIcon />
          </IconFooterLink>
          <IconFooterLink href={LINKEDIN_URL} ariaLabel="LinkedIn">
            <LinkedInIcon />
          </IconFooterLink>
          <IconFooterLink href={WEBSITE_URL} ariaLabel="Personal website">
            <GlobeIcon />
          </IconFooterLink>
        </nav>
      </div>
    </footer>
  );
}
