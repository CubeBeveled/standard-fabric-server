const axios = require("axios");
const fs = require("fs")

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

                fs.writeFileSync(pv + file.filename, jar.data);
                break;
              }
              
              console.log()
            }
          }
        }
      }
    }
  })