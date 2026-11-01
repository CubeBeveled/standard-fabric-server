import type { FileHashes, FileType, VersionFile } from "../types/modrinth.js";

export default class ModrinthFile {
  path: string;
  hashes: FileHashes;
  env: object;
  downloads: string[];
  fileSize: number;

  constructor({
    path,
    hashes,
    env,
    downloads,
    fileSize,
  }: {
    path: string;
    hashes: FileHashes;
    env: object;
    downloads: string[];
    fileSize: number;
  }) {
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
