const axios = require("axios");
const JSZip = require("jszip");
const fs = require("fs-extra");
const path = require("path");

const downloadPath = "../../"
const modrinthVersion = "0.0.5";
const fabricLoaderVersion = "0.16.9";
const versions = [
  "1.21.4",
  "1.21.3",
  "1.21.2",
  "1.21.1",
  "1.21",
  "1.20.4",
  "1.20.3",
  "1.20.2",
  "1.20.1",
  "1.20"
];

axios.defaults.headers.common["User-Agent"] = "CubeBeveled/standard-fabric-server";
let notFound = [];
let filePaths = new Map();

for (const v of versions) {
  if (fs.existsSync(`../../${v}`)) fs.rmSync(`../../${v}`, { recursive: true });
}

axios.get("https://api.modrinth.com/v3/user/w6wREnpz/collections")
  .then(async res => {
    for (const c of res.data) {
      if (c.id == "jIKTSUDZ") {
        console.log("Found collection");

        for (const p of c.projects) {
          const name = (await axios.get(`https://api.modrinth.com/v3/project/${p}`)).data.name;
          console.log("Getting versions of", name)
          const modVersions = await axios.get(`https://api.modrinth.com/v3/project/${p}/version`);

          for (const pv of versions) {
            console.log("Checking for version", pv)
            let found = false;

            for (const mv of modVersions.data) {
              if (mv.game_versions.includes(pv) && mv.loaders.includes("fabric")) {
                const file = mv.files[0];
                console.log("Downloading", file.filename)

                const jar = await axios.get(file.url, {
                  responseType: "arraybuffer",
                  headers: {
                    "Content-Type": "application/java-archive"
                  }
                });

                const jarFilePath = `${downloadPath}${pv}/mods/${file.filename}`
                const modObj = {
                  path: jarFilePath,
                  hashes: file.hashes,
                  downloadUrl: file.url,
                  fileSize: file.size
                }

                if (filePaths.has(pv)) {
                  filePaths.get(pv).push(modObj)
                } else filePaths.set(pv, [modObj])

                if (fs.existsSync(jarFilePath)) fs.writeFileSync(jarFilePath, jar.data)
                else {
                  fs.mkdirSync(path.dirname(jarFilePath), { recursive: true })
                  fs.writeFileSync(jarFilePath, jar.data)
                };

                found = true;
                break;
              }
            }

            console.log()
            if (!found) notFound.push(`${name} for ${pv}`)
          }
        }

        console.log("Making zip files");
        filePaths.forEach(async (val, key) => {
          const zip = new JSZip();

          // Debugging
          // console.log(key)
          val.forEach(mod => {
            const modZipPath = `mods/${path.basename(mod.path)}`;

            // Debugging
            // console.log(" ", modZipPath);
            zip.file(modZipPath, fs.readFileSync(path.join(__dirname, mod.path)))
          });

          const zipContent = await zip.generateAsync({ type: "nodebuffer" });
          fs.writeFileSync(`${downloadPath}${key}/sfs-${key}.zip`, zipContent);
        });

        console.log("Making mrpack files");
        filePaths.forEach(async (val, key) => {
          const zip = new JSZip();

          let modrinthIndex = {
            formatVersion: 1,
            game: "minecraft",
            versionId: modrinthVersion,
            name: "SFS " + key,
            summary: "The standard mods every fabric server needs",
            files: [],
            dependencies: {
              minecraft: key,
              "fabric-loader": fabricLoaderVersion
            }
          };

          // Debugging
          // console.log(key)
          val.forEach(mod => {
            modrinthIndex.files.push({
              path: `mods/${path.basename(mod.path)}`,
              hashes: mod.hashes,
              env: {
                client: "optional",
                server: "required",
              },
              downloads: [mod.downloadUrl],
              fileSize: mod.fileSize
            });
          });

          zip.file("modrinth.index.json", JSON.stringify(modrinthIndex, null, 2));
          const zipContent = await zip.generateAsync({ type: "nodebuffer" });
          fs.writeFileSync(`${downloadPath}${key}/sfs-${key}.mrpack`, zipContent);
        });

        console.log("\nDone")
        console.log("Skipped\n" + notFound.join("\n  "))
      }
    }
  })