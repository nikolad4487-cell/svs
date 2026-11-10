import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validRichDocument,
  richText,
  plainDocument,
} from "../src/lib/learning/rich-text";
test("structured learning documents preserve plain content and reject executable links, unknown nodes and excessive depth", () => {
  assert.equal(
    richText(plainDocument("Prvi red\nDrugi red")),
    "Prvi red\nDrugi red",
  );
  assert.ok(validRichDocument(plainDocument("<script>Tekst</script>")));
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,test",
    "https://name:pass@example.org",
    "http://example.org",
  ]) {
    assert.ok(
      !validRichDocument({
        type: "doc",
        content: [
          {
            type: "text",
            text: "Klik",
            marks: [{ type: "link", attrs: { href } }],
          },
        ],
      }),
    );
  }
  assert.ok(
    validRichDocument({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Klik",
              marks: [
                { type: "bold" },
                { type: "link", attrs: { href: "https://example.org/upute" } },
              ],
            },
          ],
        },
      ],
    }),
  );
  assert.ok(
    !validRichDocument({
      type: "doc",
      content: [{ type: "script", text: "alert(1)" }],
    }),
  );
  let nested: unknown = { type: "text", text: "tekst" };
  for (let i = 0; i < 15; i++) nested = { type: "doc", content: [nested] };
  assert.ok(!validRichDocument(nested));
});
