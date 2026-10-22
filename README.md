# M/s Savalia Jaysukh M. — Website

## Run it
1. Install Node.js 18+ (https://nodejs.org)
2. In this folder: `npm install` (first time only)
3. Start: `npm start`
4. Site: http://localhost:8080 — Admin: http://localhost:8080/admin

## Admin — three tabs, no technical knowledge needed
- First sign-in password: `Savalia@1997` — change it from the admin panel (Change password button).
- **Works** — Add a work: pick its category, fill the plain-language form, choose a photo
  from the library or upload one, Save. It appears in the List of Works immediately, in the
  site's style, with its own detail page. Tick "Feature on the homepage" to also show it in
  Selected Works. Edit or delete any work from the same list.
- **Website Text & Details** — every written word on the site (firm name, phone, email,
  addresses, hours, homepage headline, About text, safety text…) plus the Clients list
  (names, the line under each, and logos for the Clients page logo wall) is editable here.
  Change, press Save changes, done. The design cannot be broken from this tab.
- **Photos** — the photo library: upload new photos, set the homepage banner photo,
  delete uploaded photos. A work with no photo shows a branded plate with the firm's
  name on the website — never a stand-in picture.
- All works live in `data/works.json` and all texts in `data/site.json`
  (back these two files up — together they are the website's content).

## Self-contained
- Every photograph and every font is a local file inside this folder — the site does not
  load images or fonts from the internet, so nothing breaks if an outside source disappears.
  (The only external element is the Google Maps box on the Contact page.)
- Without the server running, the pages fall back to the built-in copy of the 43-work register.
