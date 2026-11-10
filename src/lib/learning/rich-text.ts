import { serviceLoginUrl } from "../external-services";
export type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
};
const nodes = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
]);
const marks = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
]);
export function validRichDocument(value: unknown): value is RichNode {
  if (JSON.stringify(value)?.length > 120000) return false;
  let count = 0;
  function valid(node: unknown, depth: number): node is RichNode {
    if (
      ++count > 3000 ||
      depth > 12 ||
      !node ||
      typeof node !== "object" ||
      Array.isArray(node)
    )
      return false;
    const n = node as RichNode;
    if (!nodes.has(n.type) || (depth === 0 && n.type !== "doc")) return false;
    if (
      n.type === "text" &&
      (typeof n.text !== "string" || n.text.length > 20000)
    )
      return false;
    if (
      n.marks &&
      (!Array.isArray(n.marks) ||
        n.marks.length > 8 ||
        !n.marks.every(
          (m) =>
            m &&
            marks.has(m.type) &&
            (m.type !== "link" ||
              (typeof m.attrs?.href === "string" &&
                m.attrs.href.length <= 2048 &&
                !!serviceLoginUrl(m.attrs.href) &&
                !/[\s@]/.test(m.attrs.href))),
        ))
    )
      return false;
    return (
      !n.content ||
      (Array.isArray(n.content) &&
        n.content.length <= 300 &&
        n.content.every((c) => valid(c, depth + 1)))
    );
  }
  return valid(value, 0);
}
export function richText(node: RichNode): string {
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";
  return (node.content || [])
    .map(richText)
    .join(
      ["doc", "bulletList", "orderedList", "listItem", "blockquote"].includes(
        node.type,
      )
        ? "\n"
        : "",
    );
}
export function plainDocument(text: string): RichNode {
  return {
    type: "doc",
    content: text
      .split("\n")
      .map((line) => ({
        type: "paragraph",
        ...(line ? { content: [{ type: "text", text: line }] } : {}),
      })),
  };
}
