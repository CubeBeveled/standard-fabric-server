import ModrinthFile from "./packFile.js";

export default class ModrinthIndex {
  formatVersion: number;
  game: string;
  versionId: string;
  name: string;
  summary: string;
  dependencies: object;
  files: ModrinthFile[];

  constructor({
    game,
    versionId,
    name,
    summary,
    dependencies,
    formatVersion,
  }: {
    game: string;
    versionId: string;
    name: string;
    summary: string;
    dependencies: object;
    formatVersion?: number;
  }) {
    this.formatVersion = formatVersion ?? 1;
    this.game = game;
    this.versionId = versionId;
    this.name = name;
    this.summary = summary;
    this.dependencies = dependencies;

    this.files = [];
  }

  /**
   * @param {ModrinthFile} file
   */
  addFile(file: ModrinthFile) {
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
