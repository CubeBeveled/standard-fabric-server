// @ts-check

class ModrinthFile {
  /**
   *
   * @param {{path: string, hashes: string[], env: object, downloads: string[], fileSize: number}} param0
   */
  constructor({ path, hashes, env, downloads, fileSize }) {
    this.path = path;
    this.hashes = hashes;
    this.env = env;
    this.downloads = downloads;
    this.fileSize = fileSize;
  }

  toJSON() {
    return {
      path: this.path,
      hashes: this.hashes,
      env: this.env,
      downloads: this.downloads,
      fileSize: this.fileSize,
    };
  }
}

module.exports = ModrinthFile;
