import { Fragment } from "react";
import type { ReactNode } from "react";
import {
  validRichDocument,
  richText,
  type RichNode,
} from "@/lib/learning/rich-text";
import { serviceLoginUrl } from "@/lib/external-services";
export function RichContent({
  document,
  fallback,
}: {
  document?: unknown;
  fallback: string;
}) {
  if (!validRichDocument(document) || !richText(document).trim())
    return (
      <p className="whitespace-pre-wrap break-words text-sm leading-7">
        {fallback}
      </p>
    );
  const render = (node: RichNode): ReactNode => {
    const children = node.content?.map((c, i) => (
      <Fragment key={i}>{render(c)}</Fragment>
    ));
    if (node.type === "text")
      return (node.marks || []).reduce<ReactNode>((text, mark) => {
        switch (mark.type) {
          case "bold":
            return <strong>{text}</strong>;
          case "italic":
            return <em>{text}</em>;
          case "underline":
            return <u>{text}</u>;
          case "strike":
            return <s>{text}</s>;
          case "code":
            return <code>{text}</code>;
          case "link": {
            const href = serviceLoginUrl(String(mark.attrs?.href || ""));
            return href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {text}
              </a>
            ) : (
              text
            );
          }
          default:
            return text;
        }
      }, node.text);
    switch (node.type) {
      case "paragraph":
        return <p>{children || <br />}</p>;
      case "heading":
        return Number(node.attrs?.level) === 3 ? (
          <h3>{children}</h3>
        ) : (
          <h2>{children}</h2>
        );
      case "bulletList":
        return <ul>{children}</ul>;
      case "orderedList":
        return <ol>{children}</ol>;
      case "listItem":
        return <li>{children}</li>;
      case "blockquote":
        return <blockquote>{children}</blockquote>;
      case "codeBlock":
        return (
          <pre>
            <code>{children}</code>
          </pre>
        );
      case "horizontalRule":
        return <hr />;
      case "hardBreak":
        return <br />;
      default:
        return <>{children}</>;
    }
  };
  return (
    <div className="learning-rich break-words text-sm leading-7">
      {render(document)}
    </div>
  );
}
