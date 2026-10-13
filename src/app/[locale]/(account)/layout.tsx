import { PagesFrame } from "@/components/PagesFrame";

/**
 * Sign-in, accepting an invitation and the reader's account: the same light
 * frame as (pages), but never behind maintenance mode — the team signs in to
 * the admin while the public site is down.
 */
export default function AccountLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return <PagesFrame {...props} gated={false} />;
}
