const FormData = require("form-data");
const { Command } = require("commander");
const axios = require("axios");
const path = require("path");
const fs = require("fs");

const metadata = require("../metadata.json");
const package = require("./package.json");

const program = new Command();

program
  .name("sfs-uploader")
  .description("Uploads standard fabric server versions to modrinth")
  .version(package.version)
  .argument("<pat-token>");

program.parse();

const changelog = "";
const downloadPath = "../../";
const token = program.args[0];
const projectID = metadata.projectID;

main();
async function main() {
  for (const version of fs.readdirSync(downloadPath, { withFileTypes: true })) {
    if (version.isDirectory()) {
      const versionRegex = /[0-9]{1,2}\.[0-9]{1,2}(\.[0-9]{1,2})?/;
      if (!versionRegex.test(version.name)) continue;

      let zipPath;
      let mrpackPath;

      for (const file of fs.readdirSync(path.join(downloadPath, version.name), {
        withFileTypes: true,
      })) {
        if (file.isFile()) {
          if (file.name.endsWith(".mrpack"))
            mrpackPath = path.join(downloadPath, version.name, file.name);
          if (file.name.endsWith(".zip"))
            zipPath = path.join(downloadPath, version.name, file.name);
        }
      }

      if (!zipPath || !mrpackPath) {
        console.log(
          `Could not find ${"zip" ? !zipPath : "mrpack"} for version ${
            version.name
          }`,
        );
        continue;
      }

      const versionData = {
        name: `Standard Fabric Server v${metadata.version} for ${version.name}`,
        version_number: metadata.version,
        changelog,
        dependencies: [],
        game_versions: [version.name],
        version_type: "release", // release / beta / alpha
        loaders: ["fabric"],
        featured: true,
        project_id: projectID,
        file_parts: ["mrpack", "zip"],
        primary_file: "mrpack",
      };

      const form = new FormData();
      form.append("data", JSON.stringify(versionData));
      form.append("mrpack", fs.createReadStream(mrpackPath));
      form.append("zip", fs.createReadStream(zipPath));

      try {
        const res = await axios.post(
          "https://api.modrinth.com/v2/version",
          form,
          {
            headers: {
              Authorization: token,
              ...form.getHeaders(),
            },
            maxBodyLength: Infinity,
          },
        );

        console.log(
          `✅ Uploaded v${versionData.version_number} for ${
            version.name
          } (${JSON.stringify(versionData.game_versions)})`,
        );
      } catch (err) {
        console.error(`Upload for ${version.name} failed`);
        console.log(form);
        if (err.response) {
          console.error("Status:", err.response.status);
          console.error("Data:", err.response.data);
        } else {
          console.error(err);
        }
      }
    }
  }

  console.log("Done");
}
