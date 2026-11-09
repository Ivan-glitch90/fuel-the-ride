#!/usr/bin/env bash
# Dump → prove it restores → encrypt. Used by the nightly backup and by CI's backup drill.
#
#   BACKUP_URI=<source>  RESTORE_TEST_URI=<scratch mongo>  AGE_RECIPIENT=<age1…>  OUT_DIR=<dir>  scripts/backup-db.sh
#
# Writes OUT_DIR/fuel-ride-<UTC stamp>.archive.gz.age and prints its path last. The plaintext dump
# exists only inside OUT_DIR (mode 700) while running and is deleted before the script ends.
# Needs: docker (official mongo:8.2 image for mongodump/mongorestore/mongosh) and age.
set -euo pipefail

: "${BACKUP_URI:?set BACKUP_URI}"
: "${RESTORE_TEST_URI:?set RESTORE_TEST_URI}"
: "${AGE_RECIPIENT:?set AGE_RECIPIENT}"
: "${OUT_DIR:?set OUT_DIR}"
DB_NAME="${DB_NAME:-fuel_ride}"
MONGO_IMAGE="${MONGO_IMAGE:-mongo:8.2}"

umask 077
mkdir -p "$OUT_DIR"
plain="$OUT_DIR/dump.archive.gz"
trap 'rm -f "$plain"' EXIT # never leave the plaintext behind, even on failure

echo "1/3 Dumping…"
# The URI goes in by environment variable, never on a command line (process lists, logs)
docker run --rm --network host -e BACKUP_URI "$MONGO_IMAGE" \
  sh -c 'mongodump --uri="$BACKUP_URI" --archive --gzip --quiet' > "$plain"
size=$(wc -c < "$plain" | tr -d ' ')
echo "    dump size: $size bytes"
if [ "$size" -lt 200 ]; then
  echo "ERROR: the dump is empty or failed." >&2
  exit 1
fi

echo "2/3 Proving it restores (scratch database, then discarded)…"
docker run --rm --network host -i "$MONGO_IMAGE" \
  mongorestore --uri="$RESTORE_TEST_URI" --archive --gzip --drop --quiet < "$plain"
# Counts only, no data, so the log shows what the backup contains
docker run --rm --network host -e DB_NAME "$MONGO_IMAGE" mongosh --quiet "$RESTORE_TEST_URI/$DB_NAME" --eval '
  const names = db.getCollectionNames().sort();
  if (!names.includes("users")) { print("ERROR: no users collection in the backup"); quit(1); }
  names.forEach((n) => print("    " + n.padEnd(14) + db[n].countDocuments()));'

echo "3/3 Encrypting…"
out="$OUT_DIR/fuel-ride-$(date -u +%Y-%m-%dT%H%MZ).archive.gz.age"
age --encrypt --recipient "$AGE_RECIPIENT" --output "$out" "$plain"
rm -f "$plain"
echo "$out"
