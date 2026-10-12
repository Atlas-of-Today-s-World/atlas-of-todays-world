/**
 * The part of a client address a rate limit counts by. IPv4 as it is; IPv6 by
 * its /64 network — one subscriber usually gets a whole /64, so counting each
 * full address would let a single client rotate through billions of them.
 */
export function rateLimitAddress(ip: string): string {
  if (!ip.includes(":")) return ip;
  // Expand "::" so the first four groups are the real /64 prefix.
  const [head = "", tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = ip.includes("::") ? (tail ? tail.split(":") : []) : [];
  const groups = ip.includes("::")
    ? [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
    : left;
  return `${groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}
