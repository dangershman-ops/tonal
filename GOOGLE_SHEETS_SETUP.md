# Logging quotes to Google Sheets

The Send screen posts the quote to **every URL** in `SHEETS_WEBHOOK_URLS` in
`app.js` whenever a rep submits a valid quote — each is an independent,
fire-and-forget POST, so one sheet's script erroring doesn't stop the other
from receiving the quote. The payload looks like:

```json
{
  "contactMethod": "email",
  "contactValue": "customer@email.com",
  "store": "Bellevue",
  "quoteLines": "Tonal 2 trainer: $4,295 + Essential Accessories: $495 + 5-Year Warranty: $449 + Subtotal (pre-tax, shipping and discount): $5,239",
  "subtotalPreTax": "$5,239",
  "totalPrice": "$5,239",
  "purchaseLink": "https://www.tonal.com/cart/49151847006490:1,...",
  "agentId": "26",
  "mode": "Buy",
  "trainer": "Tonal 2",
  "accessories": "Essential Accessories",
  "warranty": "5-Year Warranty",
  "coupon": "Trainer discount (20%): -$859; Coupon: BFCM11NYE",
  "timestamp": "2026-08-04T17:03:39.306Z"
}
```

**Quote Details and Subtotal exclude tax, shipping, AND the manual %/$
discount** — they show trainer + accessories + warranty only. This is a
sheet-only view; the on-screen quote the rep and customer see is unaffected.
The discount amount is instead carried in the **Coupon** field so reps can
still see what to quote the customer.

---

## Sheet 1 — the original sheet (unchanged layout)

Columns stay in the order already deployed there:

```
A Timestamp | B Contact Method | C Contact Info | D Quote Details (Pre-Tax, Shipping and Discount) | E Subtotal (Pre-Tax, Shipping and Discount) | F Store | G Purchase Link | H Agent ID | I Mode | J Trainer | K Accessories | L Warranty | M Coupon
```

Its `doPost` (unchanged):

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    new Date(data.timestamp || Date.now()),        // A Timestamp
    data.contactMethod || '',                       // B Contact Method
    data.contactValue || '',                        // C Contact Info
    data.quoteLines || '',                          // D Quote Details (Pre-Tax, Shipping and Discount)
    data.subtotalPreTax || data.totalPrice || '',   // E Subtotal (Pre-Tax, Shipping and Discount)
    data.store || '',                               // F Store
    data.purchaseLink || '',                        // G Purchase Link
    data.agentId || '',                             // H Agent ID
    data.mode || '',                                // I Mode
    data.trainer || '',                             // J Trainer
    data.accessories || '',                         // K Accessories
    data.warranty || '',                            // L Warranty
    data.coupon || '',                              // M Coupon
  ]);
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Sheet 2 — the new sheet, "test" tab, reordered columns

Store and Agent ID move to the leftmost columns (A, B); everything else keeps
its previous relative order, shifted right:

```
A Store | B Agent ID | C Timestamp | D Contact Method | E Contact Info | F Quote Details (Pre-Tax, Shipping and Discount) | G Subtotal (Pre-Tax, Shipping and Discount) | H Purchase Link | I Mode | J Trainer | K Accessories | L Warranty | M Coupon
```

Its `doPost` — note **`getSheetByName('test')`** instead of
`getActiveSheet()`, so this script can only ever write to that one tab, no
matter which tab is open when it runs:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('test');
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    data.store || '',                               // A Store
    data.agentId || '',                              // B Agent ID
    new Date(data.timestamp || Date.now()),          // C Timestamp
    data.contactMethod || '',                        // D Contact Method
    data.contactValue || '',                         // E Contact Info
    data.quoteLines || '',                           // F Quote Details (Pre-Tax, Shipping and Discount)
    data.subtotalPreTax || data.totalPrice || '',    // G Subtotal (Pre-Tax, Shipping and Discount)
    data.purchaseLink || '',                         // H Purchase Link
    data.mode || '',                                 // I Mode
    data.trainer || '',                              // J Trainer
    data.accessories || '',                          // K Accessories
    data.warranty || '',                             // L Warranty
    data.coupon || '',                               // M Coupon
  ]);
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Make sure row 1 of the **test** tab has matching headers in that same order
(A Store, B Agent ID, C Timestamp, ... M Coupon) before quotes start
appending.

## app.js — the two webhook URLs

```javascript
const SHEETS_WEBHOOK_URLS = [
  'https://script.google.com/macros/s/AKfycbzg5uDJ_HtuLQAO2gcgZpmYyuCJfDqBlxd_P4Wvo7L-cUmd1k7bdPwLsI97wFIuPrkspw/exec', // Sheet 1
  'https://script.google.com/macros/s/AKfycbw9ZXb5AoA6lWrbxL3HFKwvaab7v61UICSylPOSUeL7ftjTl6VgS90uZpiufwMymyhD/exec', // Sheet 2, "test" tab
];
```

To add or remove a sheet later, just add/remove a URL in this array — no
other code changes needed. `logQuoteToSheet` POSTs the same payload to every
URL in the list independently.

## Redeploying either script

Saving code in the Apps Script editor is **not** enough — the existing
`/exec` URL keeps serving the old version until you redeploy:

1. **Deploy → Manage deployments**.
2. Click the pencil (edit) on the active deployment.
3. Set **Version** to **New version**.
4. Click **Deploy**.

The `/exec` URL stays the same, so no change is needed in `app.js` after a
redeploy (only when actually switching to a different deployment/URL).

### Notes

- Each webhook call uses `mode: 'no-cors'`, so the browser can't read either
  response; both fire independently and the app moves on regardless of
  whether either succeeds.
- If Sheet 2 stops receiving rows, check that a tab literally named `test`
  exists in that spreadsheet — `getSheetByName` returns `null` (and the
  script throws) if the name doesn't match exactly, including case.
- The tonal.com checkout link is built from the quote (trainer, accessories,
  warranty, buy/rent), the rep's **Agent ID**, the selected **store** (its
  location code), and an optional **coupon**. It is not shown on-screen; it
  is only recorded in the sheet(s) on Send.
