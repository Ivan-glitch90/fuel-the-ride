#!/usr/bin/env bash
# Restore an encrypted nightly backup (docs/BACKUPS.md).
#
#   scripts/restore-backup.sh <backup.archive.gz.age> <age key file> <target MongoDB URI>
#
# The target's collections are REPLACED (--drop). Restore into a test database first
# (e.g. a local mongo or a separate Atlas database) unless you really mean production.
# Needs: age (brew install age) and mongorestore (brew install mongodb-database-tools).
set -euo pipefail

if [ $# -ne 3 ]; then
  echo "Usage: $0 <backup.archive.gz.age> <age key file> <target MongoDB URI>" >&2
  exit 64
fi
backup="$1"
key="$2"
target="$3"

for tool in age mongorestore; do
  command -v "$tool" > /dev/null || { echo "Missing '$tool'. Install it first (see docs/BACKUPS.md)." >&2; exit 69; }
done
[ -f "$backup" ] || { echo "No such backup file: $backup" >&2; exit 66; }
[ -f "$key" ] || { echo "No such key file: $key" >&2; exit 66; }

# Show where it's going without printing the password
shown_target=$(printf '%s' "$target" | sed -E 's#(://[^:/@]+:)[^@]*@#\1****@#')
echo "About to REPLACE the data in: $shown_target"
echo "with the backup:              $backup"
read -r -p "Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Cancelled."; exit 1; }

# Decrypt straight into mongorestore: the plaintext never touches the disk
age --decrypt --identity "$key" "$backup" | mongorestore --uri="$target" --archive --gzip --drop
echo "Restore finished."
