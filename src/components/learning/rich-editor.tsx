"use client";
import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Quote,
  Undo2,
  Redo2,
  Link2,
  Unlink,
  Strikethrough,
} from "lucide-react";
import {
  plainDocument,
  richText,
  validRichDocument,
  type RichNode,
} from "@/lib/learning/rich-text";
import { serviceLoginUrl } from "@/lib/external-services";
export function RichEditor({
  name,
  label,
  value = "",
  document,
}: {
  name: string;
  label: string;
  value?: string;
  document?: RichNode | null;
}) {
  const initial = validRichDocument(document) ? document : plainDocument(value);
  const [content, setContent] = useState<RichNode>(initial),
    [link, setLink] = useState(""),
    [showLink, setShowLink] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, protocols: ["https"], autolink: false },
      }),
    ],
    immediatelyRender: false,
    content: initial,
    onUpdate: ({ editor }) => setContent(editor.getJSON() as RichNode),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        class: "learning-rich min-h-48 p-4 outline-none",
      },
    },
  });
  const buttons = [
    ["Podebljano", Bold, () => editor?.chain().focus().toggleBold().run()],
    ["Kurziv", Italic, () => editor?.chain().focus().toggleItalic().run()],
    [
      "Precrtano",
      Strikethrough,
      () => editor?.chain().focus().toggleStrike().run(),
    ],
    [
      "Naslov",
      Heading2,
      () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    ],
    ["Popis", List, () => editor?.chain().focus().toggleBulletList().run()],
    [
      "Numerirani popis",
      ListOrdered,
      () => editor?.chain().focus().toggleOrderedList().run(),
    ],
    ["Citat", Quote, () => editor?.chain().focus().toggleBlockquote().run()],
    ["Poveznica", Link2, () => setShowLink(!showLink)],
    [
      "Ukloni poveznicu",
      Unlink,
      () => editor?.chain().focus().unsetLink().run(),
    ],
    ["Poništi", Undo2, () => editor?.chain().focus().undo().run()],
    ["Ponovi", Redo2, () => editor?.chain().focus().redo().run()],
  ] as const;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <input type="hidden" name={name} value={richText(content)} />
      <input type="hidden" name="rich_body" value={JSON.stringify(content)} />
      <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
        <div
          role="toolbar"
          aria-label={`Oblikovanje: ${label}`}
          className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2"
        >
          {buttons.map(([title, Icon, run]) => (
            <button
              type="button"
              key={title}
              aria-label={title}
              title={title}
              onClick={run}
              disabled={!editor}
              className="rounded p-2 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <Icon size={18} />
            </button>
          ))}
        </div>
        {showLink && (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
            <input
              type="url"
              aria-label="HTTPS poveznica u tekstu"
              placeholder="https://…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="min-w-0 flex-1 rounded border border-slate-300 p-2 text-sm"
            />
            <button
              type="button"
              disabled={!serviceLoginUrl(link) || /[\s@]/.test(link)}
              onClick={() => {
                editor
                  ?.chain()
                  .focus()
                  .extendMarkRange("link")
                  .setLink({ href: link })
                  .run();
                setShowLink(false);
              }}
              className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Umetni
            </button>
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
      <p className="text-xs text-slate-500">
        {richText(content).length}/20000 znakova. Slike, videa i dokumente
        dodajte kao privitke.
      </p>
    </div>
  );
}
