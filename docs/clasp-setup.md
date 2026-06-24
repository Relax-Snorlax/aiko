# clasp setup — sync Code.gs between local and Apps Script

`clasp` is Google's official CLI for Apps Script. It lets you push the local `apps-script/Code.gs` straight into the live Apps Script project so you don't have to copy-paste through the web editor every time.

**Use when:** you're about to commit a change to `apps-script/Code.gs` and want it deployed without opening the browser.

## One-time install

```bash
npm install -g @google/clasp
clasp login
```

`clasp login` opens a browser window. Sign in with the Google account that owns the Aiko spreadsheet/script. This writes a credential to `~/.clasprc.json` (already covered by typical home-dir gitignore — never commit it).

## One-time link of this project

The Aiko script is **container-bound** to the Google Sheet (it lives inside the spreadsheet rather than as a standalone script project). To link it:

1. Get the Script ID:
   - Open the Aiko sheet
   - Extensions → Apps Script
   - Project Settings (gear icon, left sidebar) → copy the **Script ID** (long string under "IDs")

2. Create `apps-script/.clasp.json` (gitignored — see below) with:
   ```json
   {
     "scriptId": "PASTE_SCRIPT_ID_HERE",
     "rootDir": "/home/brian/Websites/apps-script"
   }
   ```

3. Pull current cloud state to verify the link works:
   ```bash
   cd /home/brian/Websites/apps-script
   clasp pull
   ```
   This should fetch `Code.gs` and write a `appsscript.json` manifest. If `Code.gs` already exists locally and is newer, back it up first.

## Daily workflow

After editing `apps-script/Code.gs` locally:

```bash
cd /home/brian/Websites/apps-script
clasp push        # uploads local files to the Apps Script project
clasp open        # opens the editor in browser to test/deploy
```

To pull cloud changes back down (if you edited in the web editor):

```bash
clasp pull
```

Then commit + push to GitHub as normal.

## Gitignore additions

Add to `~/Websites/.gitignore`:

```
# clasp state (per-machine, contains script ID)
apps-script/.clasp.json
.clasprc.json
```

The `.clasp.json` contains your script ID. Not a hard secret, but per-machine config — keep it local.

## Notes

- **Script Properties are NOT synced by clasp.** `DRIVE_FOLDER_ID` and any other Script Properties live only in the cloud and must be set via the Apps Script editor's Project Settings page. This is by design — secrets stay out of source control.
- **`clasp push` overwrites cloud state.** If someone (you, on another device) edited in the web editor and you forgot to `clasp pull` first, push will clobber that change. Pull before push when in doubt.
- **Web app deployment is separate.** `clasp push` updates the source. To make the new code live for the public site, you still need to **deploy a new version** in the Apps Script editor (Deploy → Manage deployments → pencil icon → New version). clasp can do this too via `clasp deploy`, but the manual path is fine for low-frequency changes.
