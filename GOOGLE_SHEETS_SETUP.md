# Logging quote emails to Google Sheets

The Send screen already posts `{ email, timestamp }` to `SHEETS_WEBHOOK_URL` in
`app.js` whenever someone submits a valid email — you just need to create that
webhook once, under your own Google account.

## 1. Create the sheet

1. Go to [sheets.google.com](https://sheets.google.com) → new blank sheet.
2. In row 1, add headers: `Timestamp` | `Email`.

## 2. Add the Apps Script

1. In the sheet: **Extensions → Apps Script**.
2. Delete the placeholder code and paste:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([new Date(data.timestamp || Date.now()), data.email || '']);
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Save the project (any name is fine, e.g. "Pricing Calculator Webhook").

## 3. Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" → **Web app**.
3. Set **Execute as**: `Me`. Set **Who has access**: `Anyone`.
4. Click **Deploy**, then authorize the permissions Google asks for (it's your
   own script, acting on your own sheet).
5. Copy the **Web app URL** — it ends in `/exec`.

## 4. Wire it into the app

Open `app/app.js` and paste the URL into:

```javascript
const SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
```

That's it — every valid "Send" submission will append a row with the
timestamp and email. No further deploy step is needed on the Apps Script
side; it updates live.

### Notes

- The request uses `mode: 'no-cors'`, so the browser can't read the response
  (Apps Script doesn't return CORS headers) — the app fires the request and
  moves on regardless of whether it succeeds. If rows aren't showing up,
  
  double check the deployment access is set to "Anyone" and the URL ends in
  `/exec` (not `/dev`).
- Anyone with the deployed URL can technically append rows to your sheet
  (it isn't authenticated) — fine for an internal demo/testing tool, not a
  substitute for a real backend if this ever goes to production.
