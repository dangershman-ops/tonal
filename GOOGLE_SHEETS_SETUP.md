# Logging quotes to Google Sheets

The Send screen posts the quote to `SHEETS_WEBHOOK_URL` in `app.js` whenever a
rep submits a valid quote. The payload looks like:

```json
{
  "contactMethod": "email",
  "contactValue": "customer@email.com",
  "store": "Bellevue",
  "quoteLines": "Tonal 2 trainer: $4,295 + Essential Accessories: $495 + ...",
  "subtotalPreTax": "$4,790",
  "totalPrice": "$4,790",
  "purchaseLink": "https://www.tonal.com/cart/49151847006490:1,...",
  "timestamp": "2026-07-30T17:03:39.306Z"
}
```

## 1. Sheet columns (row 1 headers, in this exact order)

```
A Timestamp | B Contact Method | C Contact Info | D Quote Details (Pre-Tax) | E Subtotal (Pre-Tax) | F Store | G Purchase Link | H Agent ID | I Mode | J Trainer | K Accessories | L Warranty | M Coupon
```

Columns **G–M** are the additions. **G Purchase Link** is the full checkout
URL; **H–M** break that link into its individual components (mirroring the
retail URL-generator columns) so you can read or rebuild it per column:

- **H Agent ID** – rep's showroom agent id (attribution)
- **I Mode** – `Buy` or `Rent`
- **J Trainer** – `Tonal 2` or `Tonal 1 - Certified Refurbished`
- **K Accessories** – bundle name (blank for rentals)
- **L Warranty** – warranty name (blank for rentals)
- **M Coupon** – coupon code, if any (blank for rentals)

## 2. Apps Script

In the sheet: **Extensions → Apps Script**, and use this `doPost`. The
`appendRow` order must match the columns above exactly:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    new Date(data.timestamp || Date.now()),        // A Timestamp
    data.contactMethod || '',                       // B Contact Method
    data.contactValue || '',                        // C Contact Info
    data.quoteLines || '',                          // D Quote Details (Pre-Tax)
    data.subtotalPreTax || data.totalPrice || '',   // E Subtotal (Pre-Tax)
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

The additions from the previous version are the six lines G–M at the end.
Everything above them is unchanged.

## 3. Push the change to the live webhook

Saving the code in the editor is **not** enough — the existing `/exec` URL
keeps serving the old version until you redeploy:

1. **Deploy → Manage deployments**.
2. Click the pencil (edit) on the active deployment.
3. Set **Version** to **New version**.
4. Click **Deploy**.

The `/exec` URL stays the same, so no change is needed in `app.js`.

### Notes

- The tonal.com checkout link is built from the quote (trainer, accessories,
  warranty, buy/rent), the rep's **Agent ID**, the selected **store** (its
  location code), and an optional **coupon** — matching the retail URL roster
  format (`attributes[showroom_agent]`, `attributes[location]`). It is no
  longer shown on-screen; it is only recorded in this sheet on Send.
- Rent quotes log a `rent.tonal.com/checkout/...` link instead of a cart link.
- If the Purchase Link column stays empty, the rep hadn't entered their Agent
  ID (or no store was selected) when they sent — both are required to build a
  valid link.
- The request uses `mode: 'no-cors'`, so the browser can't read the response;
  the app fires and moves on. If rows aren't appearing, confirm the deployment
  access is "Anyone" and the URL ends in `/exec`.
