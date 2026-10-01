/**
 * Sekce oprávnění (role_permissions.section) a akce „vced" — pevný seznam
 * shodný s CHECK v DB. Bez závislosti na serveru (používá ho i klient).
 */
export const SECTIONS = [
  "news",
  "approvals",
  "areas",
  "regions",
  "layers",
  "appearance",
  "specials",
  "users",
  "members",
  "permissions",
] as const;
export type Section = (typeof SECTIONS)[number];
export type Action = "v" | "c" | "e" | "d";
