# Google Sheet + Apps Script Setup

## 1. Create a New Google Sheet

1. Go to https://sheets.google.com and create a new spreadsheet
2. Name it "Ren & Aiko Dashboard"

## 2. Create Sheet Tabs

Create four tabs with these exact column headers in row 1:

**Tab: Posts**

| A  | B    | C      | D     | E    | F         | G    |
|----|------|--------|-------|------|-----------|------|
| id | date | author | title | body | image_url | type |

**Tab: Timeline**

| A  | B    | C     | D           |
|----|------|-------|-------------|
| id | date | title | description |

**Tab: Countdown**

| A     | B           | C           |
|-------|-------------|-------------|
| label | target_date | tbd_message |

**Tab: Chats**

| A  | B          | C      | D         | E          | F         | G     |
|----|------------|--------|-----------|------------|-----------|-------|
| id | saved_date | author | chat_text | image_urls | chat_when | notes |

Then add an initial countdown row (row 2) in the Countdown tab:

| label                         | target_date          | tbd_message |
|-------------------------------|----------------------|-------------|
| Until we're together again    | 2026-04-23T23:00:00  |             |

## 3. Create a Google Drive Folder

1. Go to https://drive.google.com
2. Create a new folder called "Ren & Aiko Images"
3. Copy the folder ID from the URL — the long string after `/folders/`

## 4. Set Up Apps Script

1. In the Google Sheet, go to **Extensions > Apps Script**
2. Delete any existing code in `Code.gs`
3. Paste the contents of `apps-script/Code.gs` from this repo
4. Replace `YOUR_FOLDER_ID_HERE` with your Drive folder ID from step 3
5. Save (Ctrl+S)

## 5. Deploy as Web App

1. Click **Deploy > New deployment**
2. Click the gear icon, select **Web app**
3. Settings:
   - Description: "Ren & Aiko Dashboard API"
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**
5. Authorize the app when prompted (you'll see a permissions dialog)
6. **Copy the Web App URL** — you need this for the frontend

## 6. Configure the Frontend

1. Open `app.js` in the repo
2. Find the line: `SCRIPT_URL: 'YOUR_APPS_SCRIPT_URL_HERE'`
3. Replace with the Web App URL from step 5
4. Commit and push to deploy

## Redeploying After Changes

If you edit Code.gs later:
1. Go to **Deploy > Manage deployments**
2. Click the pencil icon on your deployment
3. Set version to **New version**
4. Click **Deploy**

**Note:** After editing `Code.gs` you MUST redeploy (new version) for the changes to take effect. The existing deployment URL is reused across redeploys, so no frontend config change is needed.

## One-Time Migration for Edit/Delete on Timeline

If you're upgrading from the earlier 3-column Timeline:

1. Insert a new column to the left of column A in the Timeline tab. The first row becomes `id | date | title | description`.
2. In the Apps Script editor, select `backfillTimelineIds` from the function dropdown and click Run. It assigns a UUID to every existing row that lacks one.
3. You only need to run this once. New rows created via the site will include an id automatically.
