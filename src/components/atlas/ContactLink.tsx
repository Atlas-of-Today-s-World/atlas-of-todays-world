import { publicEnv } from "@/lib/env";

const FALLBACK = "https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/issues";

/**
 * Where "contact us" leads: e-mail from NEXT_PUBLIC_CONTACT_EMAIL, otherwise
 * GitHub. Also fills the {{contact}} placeholder of editable site pages.
 */
export function contactTarget(): { href: string; label: string } {
  const email = publicEnv.NEXT_PUBLIC_CONTACT_EMAIL;
  return email
    ? { href: `mailto:${email}`, label: email }
    : { href: FALLBACK, label: "our public issue tracker" };
}

/** How to contact the operator (see `contactTarget`). */
export function ContactLink() {
  const { href, label } = contactTarget();
  return href.startsWith("mailto:") ? (
    <a href={href}>{label}</a>
  ) : (
    <a href={href} rel="noreferrer">
      {label}
    </a>
  );
}
