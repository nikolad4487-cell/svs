import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fileRequest,
  fileSize,
  maxLearningFileBytes,
} from "../src/lib/learning/files";
const input = {
  kind: "material",
  target: "10000000-0000-4000-8000-000000000001",
  name: "slika.png",
  type: "image/png",
  size: 100,
};
test("learning attachments accept bounded supported files and infer empty browser MIME types", () => {
  assert.equal(maxLearningFileBytes, 1073741824);
  assert.equal(fileSize(1073741824), "1.0 GB");
  assert.equal(fileRequest.parse(input).type, "image/png");
  assert.equal(
    fileRequest.parse({ ...input, name: "Predavanje.PPTX", type: "" }).type,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );
  assert.equal(
    fileRequest.parse({
      ...input,
      name: "video.mp4",
      type: "video/mp4",
      size: maxLearningFileBytes,
    }).size,
    maxLearningFileBytes,
  );
  for (const override of [
    { size: maxLearningFileBytes + 1 },
    { size: 0 },
    { name: "../slika.png" },
    { name: "a\u0000.png" },
    { name: "stranica.html", type: "text/html" },
    { name: "slika.svg", type: "image/svg+xml" },
    { type: "text/html" },
  ])
    assert.equal(
      fileRequest.safeParse({ ...input, ...override }).success,
      false,
    );
});
