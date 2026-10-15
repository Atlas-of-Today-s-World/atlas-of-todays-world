"use client";

import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { parsePopupHtml, type RichNode } from "../popup-html";
import type { MapPoint, MapPopup, PopupFont, PopupSize } from "../types";
import { cssColor } from "./PointGlyph";

const FONT_CLASS: Record<PopupFont, string> = {
  sans: "font-sans",
  display: "font-display",
  serif: "font-serif",
};

const SIZE_CLASS: Record<PopupSize, string> = {
  sm: "text-[13px]",
  md: "text-[14.5px]",
  lg: "text-[16px]",
};

function render(nodes: RichNode[]): ReactNode[] {
  return nodes.map((node, key) => {
    switch (node.kind) {
      case "text":
        return node.text;
      case "br":
        return <br key={key} />;
      case "link":
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            {render(node.children)}
          </a>
        );
      case "element": {
        const Tag = node.tag;
        return (
          <Tag key={key} style={node.style}>
            {render(node.children)}
          </Tag>
        );
      }
    }
  });
}

/**
 * A point's popup: its label as the heading and its rich text, in the
 * popup's font, size and colours. The text is drawn as React elements from
 * the parsed tree (popup-html.ts), never injected as HTML.
 */
export function PopupContent({
  point,
  popup,
  id,
}: {
  point: Pick<MapPoint, "label">;
  popup: MapPopup;
  id?: string;
}) {
  const nodes = useMemo(() => parsePopupHtml(popup.html), [popup.html]);
  return (
    <div
      id={id}
      className={cn(
        "rounded-xl px-3.5 py-3 leading-snug shadow-lg ring-1 ring-black/10",
        "[&_li]:ml-4 [&_ol]:list-decimal [&_ol,&_ul]:my-1 [&_p+p]:mt-1.5 [&_ul]:list-disc",
        FONT_CLASS[popup.font] ?? FONT_CLASS.sans,
        SIZE_CLASS[popup.size] ?? SIZE_CLASS.md,
      )}
      style={{
        color: cssColor(popup.color, "#16192b"),
        background: cssColor(popup.background, "#ffffff"),
      }}
    >
      <p className="pr-7 font-semibold">{point.label}</p>
      {nodes.length ? <div className="mt-1">{render(nodes)}</div> : null}
    </div>
  );
}
