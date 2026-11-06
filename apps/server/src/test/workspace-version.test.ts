import { existsSync, readFileSync, readdirSync } from "node:fs";
import { assert, test } from "vitest";

const root = new URL("../../../../", import.meta.url);
const readJson = (path: string) =>
  JSON.parse(readFileSync(new URL(path, root), "utf8"));

test("all workspace versions follow the root and participate in the single release", () => {
  const { version } = readJson("package.json");
  const config = readJson("release-please-config.json");
  const manifest = readJson(".release-please-manifest.json");
  const packages = ["apps", "packages"].flatMap((directory) =>
    readdirSync(new URL(directory, root), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${directory}/${entry.name}/package.json`)
      .filter((path) => existsSync(new URL(path, root))),
  );
  assert.deepEqual(Object.keys(config.packages), ["."]);
  assert.equal(config["release-type"], "node");
  assert.equal(config["include-component-in-tag"], false);
  assert.deepEqual(
    config.packages["."]["extra-files"].toSorted(),
    packages.toSorted(),
  );
  assert.equal(manifest["."], version);
  for (const path of packages)
    assert.equal(
      readJson(path).version,
      version,
      `${path} must follow the root version`,
    );
});
