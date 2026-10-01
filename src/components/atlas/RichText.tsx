import { Fragment, type ReactNode } from "react";

/**
 * Light markup for UI texts from messages/*.json: `**bold**` becomes
 * <strong>, `{name}` is replaced by `values.name` (e.g. a link). Plain React
 * elements only — no HTML is ever injected.
 */
export function RichText({
  text,
  values = {},
}: {
  text: string;
  values?: Record<string, ReactNode>;
}) {
  return text.split(/(\*\*.+?\*\*|\{\w+\})/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    const value = key === undefined ? undefined : new Map(Object.entries(values)).get(key);
    if (value !== undefined) return <Fragment key={index}>{value}</Fragment>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}
