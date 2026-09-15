import { copyFile, mkdir } from "node:fs/promises";

await mkdir(new URL("../dist/model/generated/", import.meta.url), {
  recursive: true,
});
await copyFile(
  new URL("../src/model/generated/catalog.json", import.meta.url),
  new URL("../dist/model/generated/catalog.json", import.meta.url),
);
