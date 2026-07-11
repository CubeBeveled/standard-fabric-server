// @ts-check

class Mod {
  /**
   * @param {string} path
   * @param {string[]} hashes
   * @param {string} downloadUrl
   * @param {number} fileSize
   */
  constructor(path, hashes, downloadUrl, fileSize) {
    this.path = path;
    this.hashes = hashes;
    this.downloadUrl = downloadUrl;
    this.fileSize = fileSize;
  }
}

module.exports = Mod;
