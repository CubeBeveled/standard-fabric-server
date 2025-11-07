const metadata = require("../metadata.json");
const axios = require("axios");
const JSZip = require("jszip");
const fs = require("fs-extra");
const path = require("path");

const downloadPath = "../../";
const projectVersion = metadata.version;
const fabricLoaderVersion = metadata.fabricVersion;
const collectionID = metadata.collectionID;
const versions = metadata.versions;

axios.defaults.headers.common["User-Agent"] =
  "github.com/CubeBeveled/standard-fabric-server";
let notFound = [];
let filePaths = new Map();

main();
async function main() {
  for (const version of versions) {
    if (fs.existsSync(`../../${version}`))
      fs.rmSync(`../../${version}`, { recursive: true });
  }

  const collections = (
    await axios.get("https://api.modrinth.com/v3/user/w6wREnpz/collections")
  ).data;

  for (const collection of collections) {
    if (collection.id == collectionID) {
      console.log("Found collection");

      for (const p of collection.projects) {
        const name = (
          await axios.get(`https://api.modrinth.com/v3/project/${p}`)
        ).data.name;
        console.log("Getting versions of", name);
        const modVersions = await axios.get(
          `https://api.modrinth.com/v3/project/${p}/version`
        );

        for (const version of versions) {
          console.log("Checking for version", version);
          let found = false;

          for (const mv of modVersions.data) {
            if (
              mv.game_versions.includes(version) &&
              mv.loaders.includes("fabric")
            ) {
              const file = mv.files[0];
              console.log("Downloading", file.filename);

              const jar = await axios.get(file.url, {
                responseType: "arraybuffer",
                headers: {
                  "Content-Type": "application/java-archive",
                },
              });

              const jarFilePath = path.join(
                downloadPath,
                `${version}/mods/${file.filename}`
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
          `${downloadPath}${version}/sfs-${version}.zip`,
          zipContent
        );
      });

      console.log("Making mrpack files");
      filePaths.forEach(async (val, key) => {
        const zip = new JSZip();

        let modrinthIndex = {
          formatVersion: 1,
          game: "minecraft",
          versionId: projectVersion,
          name: `SFS ${projectVersion} for ${key}`,
          summary: "The basic mods every fabric server needs",
          files: [],
          dependencies: {
            minecraft: key,
            "fabric-loader": fabricLoaderVersion,
          },
        };

        val.forEach((mod) => {
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
          path.join(downloadPath, `${key}/sfs-${key}.mrpack`),
          zipContent
        );
      });

      console.log("\nDone");
      console.log("Skipped\n" + notFound.join("\n  "));
    }
  }
}
