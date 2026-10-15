"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, Extension, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { uploadImage } from "@/features/uploads/upload";
import { ACCEPT_IMAGES } from "@/lib/upload-rules";
import { INLINE_TEXT_COLORS, INLINE_TEXT_SIZES } from "@/lib/text/inline-styles";
import { TextColorMark, TextSizeMark } from "./inline-style-marks";

/**
 * Keeps a heading's anchor (`<h2 id="data">`, linked as /about#data) when the
 * text is edited. Editors don't set it here; it isn't copied to the next
 * block on Enter. The sanitizer decides which ids survive.
 */
const HeadingAnchor = Extension.create({
  name: "headingAnchor",
  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          id: {
            default: null,
            keepOnSplit: false,
            parseHTML: (element) => element.getAttribute("id"),
            renderHTML: (attributes) => (attributes.id ? { id: attributes.id as string } : {}),
          },
        },
      },
    ];
  },
});

/** Link targets: https and mailto; with `sitePaths` also a path on this site ("/privacy"). */
const linkPattern = (sitePaths: boolean) =>
  sitePaths ? /^(https:\/\/|mailto:|\/(?![/\\]))/ : /^(https:\/\/|mailto:)/;

/**
 * Text editor (ARCHITEKTURA 5.3): TipTap with only allowed extensions —
 * h2–h4 headings, paragraphs, lists, bold/italic, link, blockquote, image from
 * Storage. The resulting HTML goes into a hidden field (`name`) and/or to
 * `onChange`; the server sanitizes it again.
 * `sitePaths`: links may also be paths on this site (site pages; article
 * text keeps absolute links, as it is also read outside the site — feeds, Markdown).
 * `compact`: a shorter box for many short texts on one page (timeline events).
 * `variant="popup"`: a map point's popup — no headings, quotes or images, but
 * text colour and size from the fixed set (lib/text/inline-styles).
 */
export function RichTextEditor({
  name,
  initialHtml,
  label,
  sitePaths = false,
  compact = false,
  variant = "article",
  onChange,
}: {
  name?: string;
  initialHtml: string;
  label: string;
  sitePaths?: boolean;
  compact?: boolean;
  variant?: "article" | "popup";
  onChange?: (html: string) => void;
}) {
  const [html, setHtml] = useState(initialHtml);
  const allowedLink = linkPattern(sitePaths);
  const popup = variant === "popup";
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: popup ? false : { levels: [2, 3, 4] },
        blockquote: popup ? false : undefined,
        horizontalRule: popup ? false : undefined,
        strike: popup ? false : undefined,
        code: false,
        codeBlock: false,
        link: false,
        underline: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["https", "mailto"],
        HTMLAttributes: { rel: "noopener noreferrer" },
        isAllowedUri: (url) => allowedLink.test(url),
      }),
      ...(popup
        ? [TextColorMark, TextSizeMark]
        : [Image.configure({ inline: false }), HeadingAnchor]),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: cn(
          "prose-atlas px-4 py-3 focus:outline-none",
          popup ? "min-h-24" : compact ? "min-h-32" : "min-h-80",
        ),
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = current.getHTML();
      setHtml(next);
      onChange?.(next);
    },
  });

  return (
    <div className="rounded-xl border border-[var(--color-field-border)] focus-within:border-[var(--color-accent)]">
      {editor ? <Toolbar editor={editor} sitePaths={sitePaths} popup={popup} /> : null}
      <EditorContent editor={editor} />
      {name ? <input type="hidden" name={name} value={html} /> : null}
    </div>
  );
}

const NO_STYLE = "";

/** Colour and size of the selected text (popup variant). */
function InlineStyleSelects({ editor }: { editor: Editor }) {
  const color = (editor.getAttributes("textColor").value as string | undefined) ?? NO_STYLE;
  const size = (editor.getAttributes("textSize").value as string | undefined) ?? NO_STYLE;
  const apply = (mark: "textColor" | "textSize", value: string) => {
    const chain = editor.chain().focus();
    (value ? chain.setMark(mark, { value }) : chain.unsetMark(mark)).run();
  };
  const select =
    "h-(--touch-min) rounded-lg border-0 bg-transparent px-2 text-[12.5px] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/50";
  return (
    <>
      <select
        aria-label="Text colour"
        value={color}
        onChange={(event) => apply("textColor", event.target.value)}
        className={select}
      >
        <option value={NO_STYLE}>Colour</option>
        {Object.keys(INLINE_TEXT_COLORS).map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Text size"
        value={size}
        onChange={(event) => apply("textSize", event.target.value)}
        className={select}
      >
        <option value={NO_STYLE}>Size</option>
        {Object.keys(INLINE_TEXT_SIZES).map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </>
  );
}

function Toolbar({
  editor,
  sitePaths,
  popup,
}: {
  editor: Editor;
  sitePaths: boolean;
  popup: boolean;
}) {
  // The hidden image field is opened by id (React Compiler: no ref
  // in the toolbar object created during render).
  const fileId = useId();
  const [error, setError] = useState("");

  const addLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(
      sitePaths
        ? "Link URL (https://…, or a page of this site, e.g. /privacy)"
        : "Link URL (https://…)",
      previous ?? "https://",
    );
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!linkPattern(sitePaths).test(url.trim())) {
      setError(
        sitePaths
          ? "The link must start with https://, mailto: or / (a page of this site)."
          : "The link must start with https:// or mailto:.",
      );
      return;
    }
    setError("");
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const tools: {
    label: string;
    icon: LucideIcon;
    run: () => void;
    active?: boolean;
    /** Not in a popup's short text. */
    articleOnly?: boolean;
  }[] = [
    {
      articleOnly: true,
      label: "Heading",
      icon: Heading2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive("heading", { level: 2 }),
    },
    {
      articleOnly: true,
      label: "Subheading",
      icon: Heading3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: editor.isActive("heading", { level: 3 }),
    },
    {
      label: "Bold",
      icon: Bold,
      run: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive("bold"),
    },
    {
      label: "Italic",
      icon: Italic,
      run: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive("italic"),
    },
    {
      label: "Bulleted list",
      icon: List,
      run: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive("bulletList"),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive("orderedList"),
    },
    {
      articleOnly: true,
      label: "Quote",
      icon: Quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive("blockquote"),
    },
    { label: "Link", icon: Link2, run: addLink, active: editor.isActive("link") },
    {
      articleOnly: true,
      label: "Image",
      icon: ImagePlus,
      run: () => document.getElementById(fileId)?.click(),
    },
    { label: "Undo", icon: Undo2, run: () => editor.chain().focus().undo().run() },
    { label: "Redo", icon: Redo2, run: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div className="border-b border-[var(--color-line)]">
      <div role="toolbar" aria-label="Text formatting" className="flex flex-wrap gap-0.5 p-1">
        {tools
          .filter((tool) => !(popup && tool.articleOnly))
          .map((tool) => (
            <button
              key={tool.label}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={tool.active}
              onClick={tool.run}
              className={cn(
                "grid size-(--touch-min) place-items-center rounded-lg text-[var(--color-ink-soft)] transition hover:bg-[var(--color-line)]/50",
                tool.active && "bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]",
              )}
            >
              <tool.icon size={17} aria-hidden />
            </button>
          ))}
        {popup ? <InlineStyleSelects editor={editor} /> : null}
        <input
          id={fileId}
          type="file"
          accept={ACCEPT_IMAGES}
          className="hidden"
          onChange={async (event) => {
            const picked = event.target.files?.[0];
            event.target.value = "";
            if (!picked) return;
            try {
              setError("");
              const src = await uploadImage(picked);
              const alt = window.prompt("Image description for screen readers (alt)", "") ?? "";
              editor.chain().focus().setImage({ src, alt }).run();
            } catch (failure) {
              setError((failure as Error).message);
            }
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="px-3 pb-2 text-[12px] text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
