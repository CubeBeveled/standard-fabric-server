export type ProjectLoaders =
  | "babric"
  | "bta-babric"
  | "bukkit"
  | "bungeecord"
  | "canvas"
  | "datapack"
  | "fabric"
  | "folia"
  | "forge"
  | "geyser"
  | "iris"
  | "java-agent"
  | "legacy-fabric"
  | "liteloader"
  | "minecraft"
  | "modloader"
  | "neoforge"
  | "nilloader"
  | "optifine"
  | "ornithe"
  | "paper"
  | "purpur"
  | "quilt"
  | "rift"
  | "spigot"
  | "sponge"
  | "vanilla"
  | "velocity"
  | "waterfall";

export type ProjectEnvironments =
  | "client_and_server"
  | "client_only"
  | "client_only_server_optional"
  | "singleplayer_only"
  | "server_only"
  | "server_only_client_optional"
  | "dedicated_server_only"
  | "client_or_server"
  | "client_or_server_prefers_both"
  | "unknown";

export type PublishStatus =
  | "listed"
  | "archived"
  | "draft"
  | "unlisted"
  | "scheduled"
  | "unknown";

export type PublishRequestedStatus =
  | "listed"
  | "archived"
  | "draft"
  | "unlisted";

export type FileHashes = { sha512: string; sha1: string };

export type FileType =
  | "required-resource-pack"
  | "optional-resource-pack"
  | "sources-jar"
  | "dev-jar"
  | "javadoc-jar"
  | "unknown"
  | "signature"
  | "nullable";

export type DependencyType =
  | "required"
  | "optional"
  | "incompatible"
  | "embedded";

export interface VersionFile {
  hashes: FileHashes;
  url: string;
  filename: string;
  primary: boolean;
  size: number;
  file_type?: FileType;
}

export type ProjectDependency = {
  version_id: string;
  project_id: string;
  file_name: string;
  dependency_type: "";
};

export type Collection = {
  id: string;
  user: string;
  name: string;
  description: string;
  icon_url: string | null;
  raw_icon_url: string | null;
  color: number | null;
  status: PublishStatus;
  created: string;
  updated: string;
  projects: string[];
};

export type Version = {
  id: string;
  project_id: string;
  author_id: string;
  date_published: string;
  downloads: number;
  game_versions: string[];
  loaders: ProjectLoaders[];
  environment: ProjectEnvironments;
  featured: boolean;
  name: string;
  version_number: string;
  changelog?: string;
  changelog_url: string | null;
  version_type: "release" | "beta" | "alpha";
  status: PublishStatus;
  requested_status: PublishRequestedStatus;
  files: VersionFile[];
  dependencies: ProjectDependency[];
};
