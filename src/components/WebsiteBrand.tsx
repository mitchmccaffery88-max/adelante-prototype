/** Supplied public brand artwork; application naming stays separate. */
export function WebsiteBrand() {
  return <span className="flex items-center gap-2" data-testid="website-brand">
    <img src="/brand/adelante-compact.svg" alt="Adelante Health" width="476" height="136" className="h-10 w-auto dark:hidden" />
    <img src="/brand/adelante-compact-dark.svg" alt="Adelante Health" width="476" height="136" className="hidden h-10 w-auto dark:block" />
  </span>;
}