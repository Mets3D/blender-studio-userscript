# Blender Studio Admin Userscript

A Tampermonkey userscript that smooths out rough edges in the Django admin
at `studio.blender.org/admin/`, mainly around the Production Log change
form.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or Violentmonkey/Greasemonkey).
2. Create a new script and paste in the contents of
   [`blender-studio-admin.user.js`](blender-studio-admin.user.js).
3. Save. It applies automatically on `studio.blender.org/admin/*`.

## Current features

- Collapsible top-level panels (Summary, Production log entries, etc.) and
  collapsible individual production log entries, with state remembered
  across reloads.
- Related-object popups (Add/Change) open as normal tabs instead of small
  chrome-less popup windows; "View selected X" links also open in a new
  tab so you don't lose unsaved form edits.
- "Add another Project" is removed from the Project field specifically
  (kept everywhere else, e.g. Author, Assets).
- Thumbnail / Resized-crop / Youtube link fields are pulled out of the
  "Summary" panel into their own "Preview" panel on production log pages.
- Entry headers drop the "Production log entry:" prefix, the "Change"
  link is icon-only, entries get a visible border for separation, and an
  empty "Legacy id" row is hidden.

## Development

This is iterated on interactively (with Claude Code) against HTML dumps
of the admin pages, since the admin isn't reachable by the assistant
directly. When something breaks, grab the relevant DOM snippet (DevTools
→ Copy → Copy outerHTML, not View Source, since the DOM is JS-modified)
plus any console errors.
