// @ts-check

const ModrinthFile = require("./modrinthFile");

class ModrinthIndex {
  /**
   *
   * @param {{game:string, versionId: string, name:string, summary:string, dependencies: object, formatVersion?: number}} param0
   */
  constructor({ game, versionId, name, summary, dependencies, formatVersion }) {
    this.formatVersion = formatVersion ?? 1;
    this.game = game;
    this.versionId = versionId;
    this.name = name;
    this.summary = summary;
    this.dependencies = dependencies;

    /**
     * @type {ModrinthFile[]}
     */
    this.files = [];
  }

  /**
   * @param {ModrinthFile} file
   */
  addFile(file) {
    if (!(file instanceof ModrinthFile))
      throw Error(`Expected ModrinthFile got ${typeof file}`);

    this.files.push(file);
  }

  toJSON() {
    return {
      formatVersion: this.formatVersion,
      game: this.game,
      versionId: this.versionId,
      name: this.name,
      summary: this.summary,
      dependencies: this.dependencies,
      files: this.files.map((f) => f.toJSON()),
    };
  }
}

module.exports = ModrinthIndex;
