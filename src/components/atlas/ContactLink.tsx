import { publicEnv } from "@/lib/env";

const FALLBACK = "https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/issues";

/** How to contact the operator: e-mail from NEXT_PUBLIC_CONTACT_EMAIL, otherwise GitHub. */
export function ContactLink() {
  const email = publicEnv.NEXT_PUBLIC_CONTACT_EMAIL;
  return email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    <a href={FALLBACK} rel="noreferrer">
      our public issue tracker
    </a>
  );
}
