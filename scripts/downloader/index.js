// @ts-check
const metadata = require("../metadata.json");
const axios = require("axios");
const JSZip = require("jszip");
const fs = require("fs-extra");
const path = require("path");

const Mod = require("./classes/mod.js");
const ModrinthIndex = require("./classes/modrinthIndex.js");
const ModrinthFile = require("./classes/modrinthFile.js");

const downloadPath = "../../";
const projectVersion = metadata.version;
const fabricLoaderVersion = metadata.fabricVersion;
const mcVersions = metadata.versions;

axios.defaults.headers.common["User-Agent"] =
  "github.com/CubeBeveled/standard-fabric-server";

/**
 * @type {string[]}
 */
let notFound = [];

/**
 * @type {Map<string, Mod[]>}
 */
const filePaths = new Map();

main();
async function main() {
  for (const version of mcVersions) {
    if (fs.existsSync(`../../${version}`))
      fs.rmSync(`../../${version}`, { recursive: true });
  }

  const collection = await findCollection("w6wREnpz", metadata.collectionID);
  if (collection) console.log("Found collection");
  else process.exit(1);

  // Iterate over each mod in the collection
  for (const project of collection.projects) {
    const name = (await getProjectMetadata(project)).name;

    console.log("Getting versions of", name);

    for (const version of mcVersions) {
      console.log(`Checking ${name} for version ${version}`);
      let found = false;

      // Check if the mod is available for each needed version
      for (const modVersion of await getProjectVersions(project)) {
        if (
          !modVersion.game_versions.includes(version) ||
          !modVersion.loaders.includes("fabric")
        )
          continue;

        const file = modVersion.files.find(
          (/** @type {{ filename: string; }} */ f) =>
            f.filename.endsWith(".jar"),
        );
        if (!file) continue;

        console.log("Downloading", file.filename);

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

        const modObj = new Mod(jarFilePath, file.hashes, file.url, file.size);

        const modList = filePaths.get(version);
        if (modList) {
          modList.push(modObj);
        } else filePaths.set(version, [modObj]);

        if (fs.existsSync(jarFilePath)) fs.writeFileSync(jarFilePath, jar.data);
        else {
          fs.mkdirSync(path.dirname(jarFilePath), { recursive: true });
          fs.writeFileSync(jarFilePath, jar.data);
        }

        found = true;
        break;
      }

      console.log();
      if (!found) notFound.push(`${name} for ${version}`);
    }
  }

  console.log("Making zip files");
  filePaths.forEach(async (mods, version) => {
    const zip = new JSZip();

    mods.forEach((mod) => {
      const modZipPath = `mods/${path.basename(mod.path)}`;
      zip.file(modZipPath, fs.readFileSync(path.join(__dirname, mod.path)));
    });

    const zipContent = await zip.generateAsync({ type: "nodebuffer" });
    fs.writeFileSync(
      path.join(downloadPath, version, `sfs-${version}.zip`),
      zipContent,
    );
  });

  console.log("Making mrpack files");
  filePaths.forEach(async (mods, mcVer) => {
    const zip = new JSZip();

    let modrinthIndex = new ModrinthIndex({
      game: "minecraft",
      versionId: projectVersion,
      name: `SFS ${projectVersion} for ${mcVer}`,
      summary: "The basic mods every fabric server needs",
      dependencies: {
        minecraft: mcVer,
        "fabric-loader": fabricLoaderVersion,
      },
    });

    mods.forEach((mod) => {
      modrinthIndex.addFile(
        new ModrinthFile({
          path: `mods/${path.basename(mod.path)}`,
          hashes: mod.hashes,
          env: {
            client: "optional",
            server: "required",
          },
          downloads: [mod.downloadUrl],
          fileSize: mod.fileSize,
        }),
      );
    });

    zip.file(
      "modrinth.index.json",
      JSON.stringify(modrinthIndex.toJSON(), null, 2),
    );
    const zipContent = await zip.generateAsync({ type: "nodebuffer" });
    fs.writeFileSync(
      path.join(downloadPath, `${mcVer}/sfs-${mcVer}.mrpack`),
      zipContent,
    );
  });

  console.log("\nDone");
  console.log("Skipped\n" + notFound.join("\n  "));
}

/**
 * @param {string} userId
 * @param {string} id
 */
async function findCollection(userId, id) {
  const collections = (
    await axios.get(`https://api.modrinth.com/v3/user/${userId}/collections`)
  ).data;

  for (const collection of collections) {
    if (collection.id == id) {
      return collection;
    }
  }

  return undefined;
}

/**
 * @param {any} projectId
 */
async function getProjectMetadata(projectId) {
  return (await axios.get(`https://api.modrinth.com/v3/project/${projectId}`))
    .data;
}

/**
 * @param {any} projectId
 */
async function getProjectVersions(projectId) {
  return (
    await axios.get(`https://api.modrinth.com/v3/project/${projectId}/version`)
  ).data;
}
