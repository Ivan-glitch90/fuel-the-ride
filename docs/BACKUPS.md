# Database backups

Every night a GitHub Actions job (`.github/workflows/backup.yml`, using `scripts/backup-db.sh`) does four things:
1. **Copies** the production database with a **read-only** database user.
2. **Proves the copy restores** into a temporary database, and logs the document count per collection (counts only, no data).
3. **Encrypts** it with [age](https://age-encryption.org), using a public key. Only **your private key** can decrypt it.
4. **Keeps the encrypted file for 90 days** as a workflow artifact.

**The repository is public.** Anyone can see that backup files exist, but they're useless without your private key. The unencrypted copy is never uploaded or printed, and it's deleted even if a step fails.

CI's **Backup drill** job runs the same script on every pull request, against a throwaway database and key. It also checks that the encrypted file can't be read without the key and can be restored with it.

## One-time setup (≈ 10 minutes)

### 1. Create your backup key (on your Mac)
```bash
brew install age
mkdir -p ~/.config/fuel-ride && chmod 700 ~/.config/fuel-ride
age-keygen -o ~/.config/fuel-ride/backup-key.txt
```
It prints `Public key: age1…`. That's the **public** half, safe to share.

**The file `~/.config/fuel-ride/backup-key.txt` is the private key.** Save a copy in your password manager now. **Without it, the backups can never be read**, by you or anyone else.

### 2. Tell GitHub the public key
```bash
gh variable set BACKUP_AGE_RECIPIENT --body "age1…"   # paste your public key
```

### 3. A read-only database user for backups (Atlas)
1. In Atlas, go to **Security → Database Access → Add New Database User**.
2. Username: `fuel-ride-backup`. Use **Autogenerate Secure Password** and copy the password.
3. Under **Database User Privileges → Built-in Role**, choose **Only read any database**, then click **Add User**.
4. Build its connection string the same way as the app's: your cluster address, this user and password, and `/fuel_ride?retryWrites=true&w=majority` at the end.
5. Save it as a GitHub **secret**. It asks for the value without showing it:
   ```bash
   gh secret set BACKUP_MONGODB_URI
   ```

### 4. Run the first backup now
GitHub → **Actions → Nightly database backup → Run workflow**. Or from a terminal:
```bash
gh workflow run backup.yml && sleep 5 && gh run watch "$(gh run list --workflow backup.yml --limit 1 --json databaseId -q '.[0].databaseId')"
```
The log shows the dump size and the per-collection counts. The encrypted file appears under the run's **Artifacts**.

## Restoring

1. **Download** a backup: in GitHub → Actions → the backup run → **Artifacts**, or:
   ```bash
   gh run download <run-id> --dir ~/Downloads/fuel-ride-backup
   ```
2. **Install the restore tools** once: `brew install age mongodb-database-tools`.
3. **Restore into a test database first**, e.g. a local MongoDB:
   ```bash
   scripts/restore-backup.sh ~/Downloads/fuel-ride-backup/*/fuel-ride-*.age ~/.config/fuel-ride/backup-key.txt mongodb://localhost:27017
   ```
   It asks you to type `RESTORE`, then decrypts straight into `mongorestore`, so the unencrypted data never touches your disk. Existing collections in the target are **replaced**.
4. **Restoring production** is the same command with the production connection string (the app's user, which can write). Do it during a quiet moment. Afterwards, check `https://fuel-the-ride.onrender.com/api/health` and log in.

## Good to know
- **90 days** of nightly backups are kept. Older ones are deleted automatically.
- **If you lose the private key**, the existing backups are unreadable. To recover, create a new key (steps 1–2); new backups use it from the next night.
- **If a key leaks**, create a new one (steps 1–2) and delete the old backup artifacts in GitHub.
- **A failed backup** turns the workflow red, and GitHub emails you (check your GitHub notification settings).
