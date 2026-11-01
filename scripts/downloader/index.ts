import axios from "axios";
import JSZip from "jszip";
import fs from "fs-extra";
import path from "path";
import ora from "ora";
import { fileURLToPath } from "url";

import ModrinthPackIndex from "./classes/packIndex.js";
import PackFile from "./classes/packFile.js";
import type { Collection, Version, VersionFile } from "./types/modrinth.js";

type Metadata = {
  version: string;
  collectionID: string;
  projectID: string;
  fabricVersion: string;
  versions: string[];
};

const metadataPath = findMetadata();
const metadata = fs.readJsonSync(metadataPath) as Metadata;
const downloadPath = path.resolve(path.dirname(metadataPath), "..");

const projectVersion = metadata.version;
const fabricLoaderVersion = metadata.fabricVersion;

// Optional CLI arguments limit the work to specific Minecraft versions
// (e.g. `node dist/index.js 1.20 1.21`). CI passes a single version so each
// test job only downloads the mods it needs.
const requestedVersions = process.argv.slice(2);
const unknownVersions = requestedVersions.filter(
  (version) => !metadata.versions.includes(version),
);
if (unknownVersions.length > 0) {
  console.error(`Unknown Minecraft version(s): ${unknownVersions.join(", ")}`);
  process.exit(1);
}

const mcVersions =
  requestedVersions.length > 0 ? requestedVersions : metadata.versions;

axios.defaults.headers.common["User-Agent"] =
  "github.com/CubeBeveled/standard-fabric-server";

let notFound: string[] = [];

const spinner = ora("Starting...").start();
type VFWithPackPath = VersionFile & { filePath: string };
const filePaths: Map<string, VFWithPackPath[]> = new Map();

main().catch((err) => {
  spinner.stop();
  console.error(err);
  process.exit(1);
});
async function main() {
  for (const version of mcVersions) {
    const versionPath = path.join(downloadPath, version);
    if (fs.existsSync(versionPath)) fs.rmSync(versionPath, { recursive: true });
  }

  const collection = await findCollection("w6wREnpz", metadata.collectionID);
  if (collection) {
    spinner.text = "Found collection";
    spinner.color = "green";
  } else {
    spinner.text = "Collection not found";
    spinner.color = "red";
    process.exit(1);
  }

  // Iterate over each mod in the collection
  for (const project of collection.projects) {
    const name = (await getProjectMetadata(project)).name;
    const projectVersions = await getProjectVersions(project);

    spinner.text = `Getting versions of name`;
    spinner.color = "blue";

    for (const version of mcVersions) {
      spinner.text = `Looking for ${name} ${version}`;

      const releaseVersion = projectVersions.find(
        (v) =>
          v.game_versions.includes(version) &&
          v.loaders.includes("fabric") &&
          v.version_type == "release",
      );
      const fallbackVersion = projectVersions.find(
        (v) =>
          v.game_versions.includes(version) && v.loaders.includes("fabric"),
      );
      const finalVersion = releaseVersion ?? fallbackVersion;

      if (!finalVersion) {
        const str = `${name} for ${version}`;
        notFound.push(str);
        spinner.text = str;
        spinner.color = "yellow";
        continue;
      }

      const file = finalVersion.files.find((f) => f.filename.endsWith(".jar"));
      if (!file) {
        spinner.text = `File not found for ${finalVersion.name}`;
        spinner.color = "yellow";

        notFound.push(
          `JAR for ${finalVersion.name} (https://modrinth.com/mod/iris/version/${finalVersion.id})`,
        );

        continue;
      }

      spinner.text = `Downloading ${file.filename}`;

      const jar = await axios.get(file.url, {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/java-archive",
        },
      });

      const jarFilePath = path.join(
        downloadPath,
        `${version}/mods/${file.filename}`,
      );

      const modObj: VFWithPackPath = {
        ...file,
        filePath: jarFilePath,
      };

      const modList = filePaths.get(version);
      if (modList) {
        modList.push(modObj);
      } else filePaths.set(version, [modObj]);

      if (fs.existsSync(jarFilePath)) fs.writeFileSync(jarFilePath, jar.data);
      else {
        fs.mkdirSync(path.dirname(jarFilePath), { recursive: true });
        fs.writeFileSync(jarFilePath, jar.data);
      }
    }
  }

  spinner.text = "Making zip files";
  for (const [version, mods] of filePaths) {
    const zip = new JSZip();

    mods.forEach((mod) => {
      const modZipPath = `mods/${path.basename(mod.filePath)}`;
      zip.file(modZipPath, fs.readFileSync(mod.filePath));
    });

    const zipContent = await zip.generateAsync({ type: "nodebuffer" });
    fs.writeFileSync(
      path.join(downloadPath, version, `sfs-${version}.zip`),
      zipContent,
    );
  }

  spinner.text = "Making mrpack files";
  for (const [mcVer, mods] of filePaths) {
    const zip = new JSZip();

    let mrpackIndex = new ModrinthPackIndex({
      game: "minecraft",
      versionId: projectVersion,
      name: `SFS ${projectVersion} for ${mcVer}`,
      summary: "The basic mods every fabric server needs",
      dependencies: {
        minecraft: mcVer,
        "fabric-loader": fabricLoaderVersion,
      },
    });

    mods.forEach((modFile) => {
      mrpackIndex.addFile(
        new PackFile({
          path: `mods/${path.basename(modFile.filePath)}`,
          hashes: modFile.hashes,
          env: {
            client: "optional",
            server: "required",
          },
          downloads: [modFile.url],
          fileSize: modFile.size,
        }),
      );
    });

    zip.file(
      "modrinth.index.json",
      JSON.stringify(mrpackIndex.toJSON(), null, 2),
    );

    const zipContent = await zip.generateAsync({ type: "nodebuffer" });

    fs.writeFileSync(
      path.join(downloadPath, `${mcVer}/sfs-${mcVer}.mrpack`),
      zipContent,
    );
  }

  spinner.stop();

  // A version with no downloadable mods would silently produce no pack and
  // fail later with a confusing "pack not found" error, so fail here instead.
  const missingPacks = mcVersions.filter(
    (version) =>
      !fs.existsSync(path.join(downloadPath, version, `sfs-${version}.zip`)),
  );
  if (missingPacks.length > 0) {
    console.error(`No pack built for: ${missingPacks.join(", ")}`);
    process.exitCode = 1;
  }

  console.log("Done");
  console.log("Skipped\n" + notFound.join("\n  "));
}

async function findCollection(
  userId: string,
  id: string,
): Promise<Collection | undefined> {
  const collections = (
    await axios.get(`https://api.modrinth.com/v3/user/${userId}/collections`)
  ).data as Collection[];

  for (const collection of collections)
    if (collection.id == id) return collection;

  return undefined;
}

async function getProjectMetadata(projectId: string) {
  return (await axios.get(`https://api.modrinth.com/v3/project/${projectId}`))
    .data;
}

async function getProjectVersions(
  projectId: string,
  changelog = false,
): Promise<Version[]> {
  return (
    await axios.get(
      `https://api.modrinth.com/v3/project/${projectId}/version${changelog ? "?include_changelog=false" : ""}`,
    )
  ).data;
}

function findMetadata(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));

  while (true) {
    const candidate = path.join(dir, "metadata.json");
    if (fs.existsSync(candidate)) return candidate;

    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("Could not find metadata.json");
    dir = parent;
  }
}
