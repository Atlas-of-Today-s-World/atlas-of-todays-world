"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
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
import { ACCEPT_IMAGES, uploadImage } from "@/lib/upload";

/**
 * Editor textu (ARCHITEKTURA 5.3): TipTap jen s povolenými rozšířeními —
 * nadpisy h2–h4, odstavce, seznamy, tučné/kurzíva, odkaz, citace, obrázek ze
 * Storage. Výsledné HTML jde do skrytého pole a server ho znovu vyčistí.
 */
export function RichTextEditor({
  name,
  initialHtml,
  label,
}: {
  name: string;
  initialHtml: string;
  label: string;
}) {
  const [html, setHtml] = useState(initialHtml);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
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
        isAllowedUri: (url) => /^(https:|mailto:)/.test(url),
      }),
      Image.configure({ inline: false }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: "prose-atlas min-h-80 px-4 py-3 focus:outline-none",
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: current }) => setHtml(current.getHTML()),
  });

  return (
    <div className="rounded-xl border border-[var(--color-line)] focus-within:border-[var(--color-accent)]">
      {editor ? <Toolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  // Skryté pole pro obrázek se otevírá podle id (React Compiler: žádný ref
  // v objektu nástrojů, který vzniká při vykreslení).
  const fileId = useId();
  const [error, setError] = useState("");

  const addLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Adresa odkazu (https://…)", previous ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^(https:\/\/|mailto:)/.test(url.trim())) {
      setError("Odkaz musí začínat https:// nebo mailto:.");
      return;
    }
    setError("");
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const tools: { label: string; icon: LucideIcon; run: () => void; active?: boolean }[] = [
    {
      label: "Nadpis",
      icon: Heading2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive("heading", { level: 2 }),
    },
    {
      label: "Podnadpis",
      icon: Heading3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: editor.isActive("heading", { level: 3 }),
    },
    {
      label: "Tučně",
      icon: Bold,
      run: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive("bold"),
    },
    {
      label: "Kurzíva",
      icon: Italic,
      run: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive("italic"),
    },
    {
      label: "Odrážky",
      icon: List,
      run: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive("bulletList"),
    },
    {
      label: "Číslovaný seznam",
      icon: ListOrdered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive("orderedList"),
    },
    {
      label: "Citace",
      icon: Quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive("blockquote"),
    },
    { label: "Odkaz", icon: Link2, run: addLink, active: editor.isActive("link") },
    { label: "Obrázek", icon: ImagePlus, run: () => document.getElementById(fileId)?.click() },
    { label: "Zpět", icon: Undo2, run: () => editor.chain().focus().undo().run() },
    { label: "Znovu", icon: Redo2, run: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div className="border-b border-[var(--color-line)]">
      <div role="toolbar" aria-label="Formátování textu" className="flex flex-wrap gap-0.5 p-1">
        {tools.map((tool) => (
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
              const alt = window.prompt("Popis obrázku pro nevidomé (alt)", "") ?? "";
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
