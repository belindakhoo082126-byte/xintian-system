import fs from "node:fs/promises";
import path from "node:path";

const source = "/home/ubuntu/repair_core_i18n_scope.json";
const stageDir = "/home/ubuntu/xintian_system/.i18n-staged/core-repaired";
const data = JSON.parse(await fs.readFile(source, "utf8"));

await fs.mkdir(stageDir, { recursive: true });

for (const result of data.results) {
  const input = result.input;
  const url = result.output?.modified_file;
  if (!url) throw new Error(`Missing staged file URL for ${input}`);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed for ${input}: HTTP ${response.status}`);

  const content = await response.text();
  if (!content.includes("export default")) {
    throw new Error(`Downloaded content for ${input} does not look like a page module`);
  }

  const destination = path.join(stageDir, path.basename(input));
  await fs.writeFile(destination, content, "utf8");
  console.log(`${path.basename(input)} -> ${destination}`);
}
