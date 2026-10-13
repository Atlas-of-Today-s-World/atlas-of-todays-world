import "server-only";
import { createElement, Fragment, type ReactNode } from "react";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { hasSlots, splitSlots, type HtmlPiece } from "@/lib/text/html-slots";

/**
 * The only place where HTML from data is inserted into the page (ARCHITEKTURA 5.1).
 * Input is sanitized again at render time — a defense in case something got
 * into the data that wasn't sanitized on save.
 *
 * `slots` fill `{name}` placeholders in the text with React elements (e.g. the
 * contact e-mail link in a FAQ answer): the sanitized HTML is split around
 * them (lib/text/html-slots.ts), no HTML string is ever built here.
 */
export function SafeHtml({
  html,
  className,
  slots,
}: {
  html: string;
  className?: string;
  slots?: Record<string, ReactNode>;
}) {
  const clean = sanitizeRichHtml(html);
  const names = slots ? Object.keys(slots) : [];
  if (!slots || !hasSlots(clean, names)) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
  }
  return <div className={className}>{render(splitSlots(clean, names), slots)}</div>;
}

function render(pieces: HtmlPiece[], slots: Record<string, ReactNode>): ReactNode[] {
  return pieces.map((piece, key) => {
    switch (piece.kind) {
      case "text":
        return <Fragment key={key}>{piece.text}</Fragment>;
      case "slot":
        return <Fragment key={key}>{new Map(Object.entries(slots)).get(piece.name)}</Fragment>;
      case "inline":
        return <span key={key} dangerouslySetInnerHTML={{ __html: piece.html }} />;
      case "element":
        return createElement(
          piece.tag,
          piece.inner ? { key, dangerouslySetInnerHTML: { __html: piece.inner } } : { key },
        );
      case "parent":
        return createElement(piece.tag, { key }, ...render(piece.children, slots));
    }
  });
}
