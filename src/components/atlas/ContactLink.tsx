import { getSiteSettings } from "@/features/site/queries";

/**
 * Where "contact us" leads: the one public contact address from the site
 * settings (Admin → Site settings; the built-in one if they can't be read).
 * Also fills the {{contact}} placeholder of editable site pages.
 */
export async function contactTarget(): Promise<{ href: string; label: string }> {
  const { email } = await getSiteSettings();
  return { href: `mailto:${email}`, label: email };
}

/** The contact address as a mail link (see `contactTarget`). */
export async function ContactLink({ className }: { className?: string }) {
  const { href, label } = await contactTarget();
  return (
    <a href={href} className={className}>
      {label}
    </a>
  );
}
