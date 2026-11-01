#!/usr/bin/env bash
#
# Installs a Fabric server for the given Minecraft version, extracts the
# corresponding server pack, and verifies that the server reaches the
# "Done (...)" startup message without crashing.
#
# Usage: scripts/test-launch.sh <minecraft-version> <fabric-loader-version> [pack-dir]
#
# Environment variables:
#   SERVER_DIR               Directory to install and run the server in.
#   FABRIC_INSTALLER_VERSION Fabric installer version (default: 1.1.2).
#   SERVER_START_TIMEOUT     Seconds to wait for startup (default: 300).
#   SERVER_MEMORY            Java -Xmx value (default: 2G).

set -euo pipefail

version="${1:?usage: $0 <minecraft-version> <fabric-loader-version> [pack-dir]}"
loader="${2:?usage: $0 <minecraft-version> <fabric-loader-version> [pack-dir]}"
pack_dir="${3:-$version}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
run_dir="${SERVER_DIR:-$(mktemp -d)}"
installer_version="${FABRIC_INSTALLER_VERSION:-1.1.2}"
start_timeout="${SERVER_START_TIMEOUT:-300}"
server_memory="${SERVER_MEMORY:-2G}"

if [[ -z "$run_dir" || "$run_dir" == "/" ]]; then
  echo "Refusing to use unsafe SERVER_DIR: '$run_dir'" >&2
  exit 1
fi

rm -rf "$run_dir"
mkdir -p "$run_dir"
cd "$run_dir"

echo "::group::Installing Fabric $loader for Minecraft $version"
curl -fsSL -o fabric-installer.jar \
  "https://maven.fabricmc.net/net/fabricmc/fabric-installer/${installer_version}/fabric-installer-${installer_version}.jar"
java -jar fabric-installer.jar server \
  -dir . \
  -mcversion "$version" \
  -loader "$loader" \
  -downloadMinecraft
echo "::endgroup::"

pack_zip="$repo_root/$pack_dir/sfs-$pack_dir.zip"
if [[ ! -f "$pack_zip" ]]; then
  echo "Server pack not found: $pack_zip" >&2
  exit 1
fi

echo "::group::Extracting $pack_zip"
unzip -q -o "$pack_zip" -d .
echo "::endgroup::"

printf 'eula=true\n' > eula.txt
cat > server.properties <<'EOF'
online-mode=false
level-type=minecraft\:flat
generate-structures=false
spawn-protection=0
max-players=1
view-distance=2
simulation-distance=2
sync-chunk-writes=false
EOF

echo "::group::Starting Minecraft $version server"
java -Xms512M -Xmx"$server_memory" -jar fabric-server-launch.jar nogui \
  > "$run_dir/server.log" 2>&1 &
server_pid=$!

deadline=$((SECONDS + start_timeout))
started=false
while (( SECONDS < deadline )); do
  if grep -q 'Done (' "$run_dir/server.log"; then
    started=true
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    break
  fi
  sleep 2
done
echo "::endgroup::"

# Make sure the server stays up for a moment after reporting that it started.
if $started; then
  sleep 5
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "Server exited shortly after startup." >&2
    started=false
  fi
fi

if compgen -G "$run_dir/crash-reports/*.txt" > /dev/null; then
  echo "A crash report was generated." >&2
  started=false
fi

echo "----- server.log (last 200 lines) -----"
tail -n 200 "$run_dir/server.log" || true
echo "---------------------------------------"

if kill -0 "$server_pid" 2>/dev/null; then
  kill "$server_pid" 2>/dev/null || true
  for _ in $(seq 1 15); do
    kill -0 "$server_pid" 2>/dev/null || break
    sleep 1
  done
  kill -9 "$server_pid" 2>/dev/null || true
fi
wait "$server_pid" 2>/dev/null || true

if $started; then
  echo "Minecraft $version server started successfully."
else
  echo "Minecraft $version server failed to start." >&2
  exit 1
fi
