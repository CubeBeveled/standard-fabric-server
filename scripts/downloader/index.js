const axios = require("axios");
const path = require("path");
const JSZip = require("jszip")
const fs = require("fs-extra");

const versions = [
  "1.21.1",
  "1.21",
  "1.20.4",
  "1.20.3",
  "1.20.2",
  "1.20.1",
  "1.20"
]

axios.defaults.headers.common["User-Agent"] = "CubeBeveled/standard-fabric-server";
let notFound = [];
let filePaths = new Map();

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
                  responseType: "arraybuffer",  // Receive the file as binary data
                  headers: {
                    "Content-Type": "application/java-archive"
                  }
                });

                const jarFilePath = `${pv}/mods/${file.filename}`

                if (filePaths.has(pv)) {
                  filePaths.get(pv).push(jarFilePath)
                } else filePaths.set(pv, [jarFilePath])

                if (fs.existsSync(jarFilePath)) fs.writeFileSync(jarFilePath, jar.data)
                else {
                  fs.mkdirSync(path.dirname(jarFilePath), { recursive: true })
                  fs.writeFileSync(jarFilePath, jar.data)
                };

                found = true;
                break;
              }

              console.log()
            }

            if (!found) notFound.push(`${name} for ${pv}`)
          }
        }

        console.log("Making zip files")
        filePaths.forEach(async (val, key) => {
          const zip = new JSZip();

          console.log(key)
          val.forEach(modPath => {
            const modZipPath = `mods/${path.basename(modPath)}`;

            console.log(" ", modZipPath);
            zip.file(modZipPath, fs.readFileSync(path.join(__dirname, modPath)))
          });

          const zipContent = await zip.generateAsync({ type: "nodebuffer" });
          fs.writeFileSync(`${key}/sfs-${key}.zip`, zipContent);
        });

        console.log("\nDone")
        console.log("Skipped\n" + notFound.join("\n  "))
      }
    }
  })