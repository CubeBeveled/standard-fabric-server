const metadata = require("../metadata.json");
const axios = require("axios");
const JSZip = require("jszip");
const fs = require("fs-extra");
const path = require("path");

const downloadPath = "../../";
const projectVersion = metadata.version;
const fabricLoaderVersion = metadata.fabricVersion;
const versions = metadata.versions;

axios.defaults.headers.common["User-Agent"] =
  "github.com/CubeBeveled/standard-fabric-server";
let notFound = [];
const filePaths = new Map();

main();
async function main() {
  for (const version of versions) {
    if (fs.existsSync(`../../${version}`))
      fs.rmSync(`../../${version}`, { recursive: true });
  }

  const collection = await findCollection("w6wREnpz", metadata.collectionID);
  if (collection) console.log("Found collection");
  else process.exit(1);

  for (const project of collection.projects) {
    const name = (await getProjectMetadata(project)).name;

    console.log("Getting versions of", name);

    for (const version of versions) {
      console.log(`Checking ${name} for version ${version}`);
      let found = false;

      for (const modVersion of await getProjectVersions(project)) {
        if (
          modVersion.game_versions.includes(version) &&
          modVersion.loaders.includes("fabric")
        ) {
          const file = modVersion.files.find((f) =>
            f.filename.endsWith(".jar"),
          );
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

          const modObj = {
            path: jarFilePath,
            hashes: file.hashes,
            downloadUrl: file.url,
            fileSize: file.size,
          };

          if (filePaths.has(version)) {
            filePaths.get(version).push(modObj);
          } else filePaths.set(version, [modObj]);

          if (fs.existsSync(jarFilePath))
            fs.writeFileSync(jarFilePath, jar.data);
          else {
            fs.mkdirSync(path.dirname(jarFilePath), { recursive: true });
            fs.writeFileSync(jarFilePath, jar.data);
          }

          found = true;
          break;
        }
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

    let modrinthIndex = {
      formatVersion: 1,
      game: "minecraft",
      versionId: projectVersion,
      name: `SFS ${projectVersion} for ${mcVer}`,
      summary: "The basic mods every fabric server needs",
      files: [],
      dependencies: {
        minecraft: mcVer,
        "fabric-loader": fabricLoaderVersion,
      },
    };

    mods.forEach((mod) => {
      modrinthIndex.files.push({
        path: `mods/${path.basename(mod.path)}`,
        hashes: mod.hashes,
        env: {
          client: "optional",
          server: "required",
        },
        downloads: [mod.downloadUrl],
        fileSize: mod.fileSize,
      });
    });

    zip.file("modrinth.index.json", JSON.stringify(modrinthIndex, null, 2));
    const zipContent = await zip.generateAsync({ type: "nodebuffer" });
    fs.writeFileSync(
      path.join(downloadPath, `${mcVer}/sfs-${mcVer}.mrpack`),
      zipContent,
    );
  });

  console.log("\nDone");
  console.log("Skipped\n" + notFound.join("\n  "));
}

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

async function getProjectMetadata(projectId) {
  return (await axios.get(`https://api.modrinth.com/v3/project/${projectId}`))
    .data;
}

async function getProjectVersions(projectId) {
  return (
    await axios.get(`https://api.modrinth.com/v3/project/${projectId}/version`)
  ).data;
}
