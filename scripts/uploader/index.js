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
  .argument(
    "[pat-token]",
    "modrinth personal access token (defaults to MODRINTH_TOKEN)",
  )
  .option("--changelog <text>", "changelog for the uploaded versions", "");

program.parse();

const token = program.args[0] ?? process.env.MODRINTH_TOKEN;
const changelog = program.opts().changelog;
const projectID = metadata.projectID;

// The downloader writes each version folder to the repository root.
const downloadPath = path.resolve(__dirname, "../..");
const apiURL = process.env.MODRINTH_API ?? "https://api.modrinth.com/v2";
const userAgent = "github.com/CubeBeveled/standard-fabric-server";

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  if (!token) {
    console.error(
      "No Modrinth token provided. Pass it as an argument or set MODRINTH_TOKEN.",
    );
    process.exit(1);
  }

  axios.defaults.headers.common["User-Agent"] = userAgent;

  const existingVersions = await getExistingVersions();
  const existingNumbers = existingVersions.map(
    (version) => version.version_number,
  );

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const version of metadata.versions) {
    const versionNumber = `${metadata.version}-${version}`;

    // Re-running a release should not create the same Modrinth version twice.
    if (existingNumbers.includes(versionNumber)) {
      console.log(`Skipping ${versionNumber}, it already exists on Modrinth`);
      skipped++;
      continue;
    }

    const versionPath = path.join(downloadPath, version);
    const mrpackPath = path.join(versionPath, `sfs-${version}.mrpack`);
    const zipPath = path.join(versionPath, `sfs-${version}.zip`);

    if (!fs.existsSync(mrpackPath) || !fs.existsSync(zipPath)) {
      console.error(`Could not find the packs for version ${version}`);
      failed++;
      continue;
    }

    const versionData = {
      name: `Standard Fabric Server v${metadata.version} for ${version}`,
      version_number: versionNumber,
      changelog,
      dependencies: [],
      game_versions: [version],
      version_type: "release", // release / beta / alpha
      loaders: ["fabric"],
      featured: true,
      project_id: projectID,
      file_parts: ["mrpack", "zip"],
      primary_file: "mrpack",
    };

    const form = new FormData();
    form.append("data", JSON.stringify(versionData));
    form.append("mrpack", fs.createReadStream(mrpackPath), {
      filename: path.basename(mrpackPath),
    });
    form.append("zip", fs.createReadStream(zipPath), {
      filename: path.basename(zipPath),
    });

    try {
      await axios.post(`${apiURL}/version`, form, {
        headers: {
          Authorization: token,
          ...form.getHeaders(),
        },
        maxBodyLength: Infinity,
      });

      uploaded++;
      console.log(`✅ Uploaded ${versionNumber} for ${version}`);
    } catch (err) {
      failed++;
      console.error(`Upload for ${version} failed`);
      printError(err);
    }
  }

  console.log(
    `Done: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`,
  );

  if (failed > 0) process.exit(1);
}

async function getExistingVersions() {
  try {
    return (await axios.get(`${apiURL}/project/${projectID}/version`)).data;
  } catch (err) {
    console.error(`Could not fetch versions for project ${projectID}`);
    printError(err);
    process.exit(1);
  }
}

function printError(err) {
  if (err.response) {
    console.error("Status:", err.response.status);
    console.error("Data:", err.response.data);
  } else {
    console.error(err);
  }
}
