// ==UserScript==
// @name         Blender Studio Admin: UX Tweaks
// @namespace    https://studio.blender.org/
// @version      2.22
// @description  Collapsible panels, tab-not-popup links, Preview panel, entry cleanup for the Django admin
// @match        https://studio.blender.org/admin/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const CHANGE_ICON_SIZE = 18;
  const STORAGE_KEY = 'us-collapsible-panels';
  const ARTIST_MODE_KEY = 'us-artist-mode';

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  const state = loadState();

  // Drop the window-features arg so popups open as real tabs; window.opener still works.
  const nativeOpen = window.open;
  window.open = function (url, name) {
    return nativeOpen.call(window, url, name);
  };

  function makeCollapsible(container, heading, key) {
    if (container.dataset.usCollapsible) return;
    container.dataset.usCollapsible = 'true';
    container.classList.add('us-collapsible');
    heading.classList.add('us-collapsible-heading');
    heading.setAttribute('role', 'button');
    heading.setAttribute('tabindex', '0');

    const arrow = document.createElement('span');
    arrow.textContent = '▾';
    arrow.className = 'us-collapse-arrow';
    heading.prepend(arrow);

    const collapsed = !!state[key];
    container.classList.toggle('us-collapsed', collapsed);
    heading.setAttribute('aria-expanded', String(!collapsed));

    function toggle(e) {
      if (e.target.closest('a, input, label, button')) return;
      const nowCollapsed = !container.classList.contains('us-collapsed');
      container.classList.toggle('us-collapsed', nowCollapsed);
      heading.setAttribute('aria-expanded', String(!nowCollapsed));
      state[key] = nowCollapsed;
      saveState(state);
    }

    heading.addEventListener('click', toggle);
    heading.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle(e);
      }
    });
  }

  function initTopLevelPanels() {
    document.querySelectorAll('fieldset.module > h2').forEach((h2) => {
      makeCollapsible(h2.closest('fieldset'), h2, h2.textContent.trim());
    });
  }

  function stripEntryPrefix(heading) {
    const b = heading.querySelector(':scope > b');
    if (!b) return;
    const next = b.nextSibling;
    b.remove();
    if (next && next.nodeType === Node.TEXT_NODE && /^[\s ]*$/.test(next.textContent)) {
      next.remove();
    }
  }

  function iconifyChangeLink(entry) {
    const link = entry.querySelector('a.inlinechangelink');
    if (!link || link.dataset.usIconified) return;
    link.dataset.usIconified = 'true';
    const iconSrc = document.querySelector('img[src*="icon-changelink"]')?.src;
    link.textContent = '';
    link.title = 'Change';
    link.setAttribute('aria-label', 'Change');
    if (iconSrc) {
      const img = document.createElement('img');
      img.src = iconSrc;
      img.width = CHANGE_ICON_SIZE;
      img.height = CHANGE_ICON_SIZE;
      img.alt = 'Change';
      link.appendChild(img);
    } else {
      link.textContent = '✎';
    }
  }

  function hideEmptyLegacyId(entry) {
    const row = entry.querySelector('.form-row.field-legacy_id');
    const val = row?.querySelector('.readonly');
    if (val && val.textContent.trim() === '-') {
      row.classList.add('us-artist-hidden');
    }
  }

  function cleanupEntryFields(entry) {
    ['field-get_edit_link', 'field-user', 'field-date_created', 'field-author'].forEach((cls) => {
      entry.querySelector(`.form-row.${cls}`)?.classList.add('us-artist-hidden');
    });
  }

  function initArtistModeToggle() {
    const nav = document.querySelector('nav[aria-label="Breadcrumbs"]');
    if (!nav || nav.querySelector('.us-artist-mode-toggle')) return;

    const wrapper = document.createElement('label');
    wrapper.className = 'button us-artist-mode-toggle';
    wrapper.title = 'Artist Mode hides fields only relevant for debugging/dev work';

    const text = document.createElement('span');
    text.textContent = 'Artist Mode';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'us-toggle-input';

    const track = document.createElement('span');
    track.className = 'us-toggle-track';
    track.appendChild(document.createElement('span')).className = 'us-toggle-thumb';

    function render() {
      const artistMode = localStorage.getItem(ARTIST_MODE_KEY) !== 'off';
      document.body.classList.toggle('us-dev-mode', !artistMode);
      checkbox.checked = artistMode;
    }

    checkbox.addEventListener('change', () => {
      localStorage.setItem(ARTIST_MODE_KEY, checkbox.checked ? 'on' : 'off');
      render();
    });

    wrapper.append(text, checkbox, track);
    render();
    nav.appendChild(wrapper);
  }

  function relocateObjectTools() {
    const nav = document.querySelector('nav[aria-label="Breadcrumbs"]');
    const submitRow = document.querySelector('.submit-row');
    const objectTools = document.querySelector('ul.object-tools');
    if (!objectTools || objectTools.dataset.usRelocated) return;
    objectTools.dataset.usRelocated = 'true';

    // History isn't used often enough to earn header real estate - park it at the bottom,
    // styled like the other submit-row buttons. View on site stays in the pinned header.
    const historyLink = objectTools.querySelector('a.historylink');
    const viewSiteLink = objectTools.querySelector('a.viewsitelink');

    if (historyLink && submitRow) {
      historyLink.classList.add('button');
      const addAnotherBtn = submitRow.querySelector('input[name="_addanother"]');
      if (addAnotherBtn) {
        // .historylink carries Django's own padding/margin/line-height, tuned for its original
        // top-of-page spot, which doesn't match the other submit-row buttons once moved here -
        // copy the real computed values from a known-correct sibling instead of guessing at them.
        const ref = getComputedStyle(addAnotherBtn);
        historyLink.style.padding = ref.padding;
        historyLink.style.margin = ref.margin;
        historyLink.style.lineHeight = ref.lineHeight;
        historyLink.style.fontSize = ref.fontSize;
        historyLink.style.verticalAlign = ref.verticalAlign;
        addAnotherBtn.insertAdjacentElement('afterend', historyLink);
      } else {
        submitRow.appendChild(historyLink);
      }
    }
    if (viewSiteLink && nav) {
      viewSiteLink.classList.add('button');
      nav.appendChild(viewSiteLink);
    }
    objectTools.remove();
  }

  function addHeaderSaveButton() {
    const nav = document.querySelector('nav[aria-label="Breadcrumbs"]');
    const continueBtn = document.querySelector('.submit-row input[name="_continue"]');
    if (!nav || !continueBtn || nav.querySelector('.us-header-save-button')) return;

    const headerSave = document.createElement('button');
    headerSave.type = 'button';
    headerSave.className = 'button us-header-save-button';
    headerSave.textContent = 'Save';
    headerSave.addEventListener('click', () => continueBtn.click());

    nav.appendChild(headerSave);
  }

  function hideRedundantPageTitle() {
    const content = document.getElementById('content');
    const h1 = content?.querySelector(':scope > h1');
    if (!h1) return;
    h1.style.display = 'none';
    const h2 = h1.nextElementSibling;
    if (h2 && h2.tagName === 'H2') {
      h2.style.display = 'none';
    }
  }

  function simplifyEntryTitle(heading) {
    const label = heading.querySelector('.inline_label');
    if (!label) return;
    for (const node of label.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const match = node.textContent.match(/:\s*(.+?)['’]s\s+Production Log Entry\b/);
        if (match) {
          node.textContent = match[1] + ' ';
        }
        break;
      }
    }
  }

  function processEntry(entry) {
    const heading = entry.querySelector(':scope > h3');
    if (!heading) return;
    stripEntryPrefix(heading);
    simplifyEntryTitle(heading);
    iconifyChangeLink(entry);
    hideEmptyLegacyId(entry);
    cleanupEntryFields(entry);
    entry.classList.add('us-entry-panel');
    const key = location.pathname + '::' + (entry.id || heading.textContent.trim());
    makeCollapsible(entry, heading, key);
  }

  function initEntries() {
    document.querySelectorAll('.inline-related').forEach(processEntry);

    const group = document.getElementById('log_entries-group');
    if (group) {
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          m.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.classList.contains('inline-related')) {
              processEntry(node);
              checkboxifyAssetSelectors();
            }
          });
        }
      }).observe(group, { childList: true, subtree: true });
    }
  }

  function reorganizePreviewPanel() {
    if (!location.pathname.includes('/projects/productionlog/')) return;
    if (document.querySelector('.us-preview-panel')) return;

    const summaryHeading = Array.from(document.querySelectorAll('fieldset.module > h2'))
      .find((h) => h.textContent.trim() === 'Summary');
    if (!summaryHeading) return;
    const summaryFieldset = summaryHeading.closest('fieldset');

    const thumbRow = summaryFieldset.querySelector('.form-row.field-thumbnail');
    const youtubeRow = summaryFieldset.querySelector('.form-row.field-youtube_link');
    if (!thumbRow && !youtubeRow) return;

    const preview = document.createElement('fieldset');
    preview.className = 'module aligned us-preview-panel';
    const h2 = document.createElement('h2');
    h2.textContent = 'Preview';
    preview.appendChild(h2);
    if (thumbRow) preview.appendChild(thumbRow);
    if (youtubeRow) preview.appendChild(youtubeRow);

    summaryFieldset.parentNode.insertBefore(preview, summaryFieldset);
  }

  function cleanupPreviewFields() {
    const thumbRow = document.querySelector('.form-row.field-thumbnail');
    if (!thumbRow) return;

    thumbRow.querySelector('.fieldBox.field-render_thumbnails')?.classList.add('us-artist-hidden');

    const p = thumbRow.querySelector('p.file-upload');
    const link = p?.querySelector('a');
    const currentlyText = p?.childNodes[0];
    if (p && link && currentlyText && currentlyText.nodeType === Node.TEXT_NODE) {
      const span = document.createElement('span');
      span.className = 'us-artist-hidden';
      p.insertBefore(span, currentlyText);
      span.append(currentlyText, link);
    }
  }

  function cleanupFileInputs() {
    document.querySelectorAll('input[type="file"]').forEach((input) => {
      if (input.dataset.usCleaned) return;
      input.dataset.usCleaned = 'true';

      // Drop the literal "Change:" text Django prints before the input for already-populated
      // fields.
      const prev = input.previousSibling;
      if (prev && prev.nodeType === Node.TEXT_NODE && /change:\s*$/i.test(prev.textContent)) {
        prev.remove();
      }

      // The native "No file chosen"/"No file selected." placeholder isn't a stylable DOM node -
      // it's rendered by the browser itself. Hide the real input (still functional, still
      // submits normally) behind our own button + a filename label we control directly.
      const wrapper = document.createElement('span');
      wrapper.className = 'us-file-input-wrapper';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button';
      button.textContent = 'Choose file';
      button.addEventListener('click', () => input.click());

      const filenameLabel = document.createElement('span');
      filenameLabel.className = 'us-file-input-name';

      function updateLabel() {
        filenameLabel.textContent = input.files.length ? input.files[0].name : '';
      }
      input.addEventListener('change', updateLabel);

      input.classList.add('us-native-file-input');
      input.insertAdjacentElement('beforebegin', wrapper);
      wrapper.append(button, filenameLabel, input);
      updateLabel();
    });
  }

  function hideAssetViewLink() {
    // Redundant with "View on site", which is now always visible in the pinned header.
    document.querySelector('.fieldBox.field-view_link')?.parentElement?.remove();
  }

  function hideDeleteRelatedLinks() {
    document.querySelectorAll('a.related-widget-wrapper-link.delete-related').forEach((a) => {
      a.classList.add('us-artist-hidden');
    });
  }

  function renameAssetCheckboxLabels() {
    const renames = {
      id_is_published: 'Published',
      id_is_featured: 'Featured',
      id_is_spoiler: 'Spoiler',
      id_contains_blend_file: 'Contains .blend',
    };
    Object.entries(renames).forEach(([id, text]) => {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) label.textContent = text;
    });
    document.getElementById('id_contains_blend_file_helptext')?.remove();
  }

  function cleanupTagsHelp() {
    const help = document.getElementById('id_tags_helptext');
    const container = help?.querySelector(':scope > div');
    const tagLink = container?.querySelector('a[href="/admin/taggit/tag/"]');
    if (!container || !tagLink) return;

    // Strip the "Only existing tags can be selected here..." sentence (and the blank line
    // before it) that leads into the link, keeping the "Start typing..." instructions above it.
    let node = tagLink.previousSibling;
    while (node) {
      const prev = node.previousSibling;
      const isTargetText = node.nodeType === Node.TEXT_NODE && /only existing tags/i.test(node.textContent);
      const isBr = node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR';
      const isWhitespace = node.nodeType === Node.TEXT_NODE && !node.textContent.trim();
      if (isTargetText) {
        node.remove();
        break;
      }
      if (isBr || isWhitespace) {
        node.remove();
        node = prev;
        continue;
      }
      break;
    }

    tagLink.textContent = 'Manage Tags';
    tagLink.classList.add('button');
  }

  function cleanupDatePublished() {
    const p = document.querySelector('.form-row.field-date_published p.datetime');
    const dateInput = p?.querySelector('#id_date_published_0');
    const timeInput = p?.querySelector('#id_date_published_1');
    if (!p || !dateInput || !timeInput) return;

    // "Date:" is redundant with the "Date published:" field label right next to it.
    const dateLabelText = dateInput.previousSibling;
    if (dateLabelText && dateLabelText.nodeType === Node.TEXT_NODE && /date:\s*$/i.test(dateLabelText.textContent)) {
      dateLabelText.remove();
    }

    // Wrap the whole "Time: <input> <shortcuts>" line, plus the <br> and blank line separating
    // it from the date line, so it can be hidden as a unit under Artist Mode.
    const timeLabelText = timeInput.previousSibling;
    if (timeLabelText && timeLabelText.nodeType === Node.TEXT_NODE) {
      const br = timeLabelText.previousSibling?.nodeType === Node.ELEMENT_NODE && timeLabelText.previousSibling.tagName === 'BR'
        ? timeLabelText.previousSibling
        : null;
      const blankLine = br && br.previousSibling?.nodeType === Node.TEXT_NODE && !br.previousSibling.textContent.trim()
        ? br.previousSibling
        : null;
      const timeShortcuts = timeInput.nextSibling;

      const span = document.createElement('span');
      span.className = 'us-artist-hidden';
      p.insertBefore(span, blankLine || br || timeLabelText);
      if (blankLine) span.appendChild(blankLine);
      if (br) span.appendChild(br);
      span.append(timeLabelText, timeInput);
      if (timeShortcuts) span.appendChild(timeShortcuts);
    }
  }

  function hideTopLevelAuthor() {
    // Scoped via the "id_author" label specifically, since each entry's own author field
    // (log_entries-N-author) shares the same "field-author" form-row class.
    const row = document.querySelector('label[for="id_author"]')?.closest('.form-row');
    if (row) row.classList.add('us-artist-hidden');
  }

  function cleanupProductionLogEntryFields() {
    if (!location.pathname.includes('/projects/productionlogentry/')) return;
    ['field-production_log', 'field-user', 'field-date_created', 'field-legacy_id'].forEach((cls) => {
      document.querySelector(`.form-row.${cls}`)?.classList.add('us-artist-hidden');
    });
  }

  function simplifySaveButtons() {
    document.querySelectorAll('.submit-row').forEach((submitRow) => {
      const continueBtn = submitRow.querySelector('input[name="_continue"]');
      const saveBtn = submitRow.querySelector('input[name="_save"]');
      if (!continueBtn || !saveBtn) return;
      continueBtn.value = 'Save';
      continueBtn.classList.add('default', 'us-save-button');
      saveBtn.style.display = 'none';
      submitRow.prepend(continueBtn);
    });
  }

  function checkboxifyAssetWidget(wrapper) {
    if (wrapper.dataset.usCheckboxified) return;

    const selector = wrapper.querySelector('.selector');
    if (!selector) {
      console.log('[us] checkboxifyAssetWidget: .selector not built yet, will retry', wrapper);
      return;
    }
    const fromSelect = selector.querySelector('select[id$="_from"]');
    const toSelect = selector.querySelector('select[id$="_to"]');
    if (!fromSelect || !toSelect) {
      console.log('[us] checkboxifyAssetWidget: from/to select missing', { fromSelect, toSelect });
      return;
    }

    // Only mark this widget as handled once we've actually confirmed SelectFilter2 has built
    // its markup - marking it earlier would permanently block the window "load" retry below
    // from ever reprocessing a widget that wasn't ready on the first pass.
    wrapper.dataset.usCheckboxified = 'true';
    console.log('[us] checkboxifyAssetWidget: converting', wrapper);

    // The "chosen" (_to) select only gets its options marked .selected on form submit, via
    // SelectFilter2's own submit handler - so we can't trust .selected while editing. Instead,
    // take over the field entirely: disable both original selects (drops them from submission)
    // and replace them with checkboxes sharing the real field name, which Django's multi-value
    // parsing reads exactly like a multi-select.
    const fieldName = toSelect.name;
    const chosenValues = new Set(Array.from(toSelect.options).map((o) => o.value));
    const allOptions = Array.from(toSelect.options).concat(Array.from(fromSelect.options));
    toSelect.disabled = true;
    fromSelect.disabled = true;

    const list = document.createElement('div');
    list.className = 'us-asset-checklist';
    allOptions
      .sort((a, b) => {
        const aChosen = chosenValues.has(a.value);
        const bChosen = chosenValues.has(b.value);
        if (aChosen !== bChosen) return aChosen ? -1 : 1;
        return a.textContent.localeCompare(b.textContent);
      })
      .forEach((opt) => {
        const row = document.createElement('div');
        row.className = 'us-asset-checkbox';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = fieldName;
        checkbox.value = opt.value;
        checkbox.checked = chosenValues.has(opt.value);
        checkbox.setAttribute('aria-label', opt.textContent);

        const link = document.createElement('a');
        link.href = `/admin/projects/asset/${opt.value}/change/`;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = opt.textContent;

        row.appendChild(checkbox);
        row.appendChild(document.createTextNode(' '));
        row.appendChild(link);
        list.appendChild(row);
      });

    selector.style.display = 'none';
    selector.insertAdjacentElement('afterend', list);
  }

  function checkboxifyAssetSelectors() {
    const wrappers = document.querySelectorAll('.related-widget-wrapper[data-model-ref="asset"]');
    console.log('[us] checkboxifyAssetSelectors: found', wrappers.length, 'asset widget(s), readyState =', document.readyState);
    wrappers.forEach(checkboxifyAssetWidget);
  }

  function fixRelatedWidgetLinks() {
    document.querySelectorAll('a.view-related, a[title^="View selected"]').forEach((a) => {
      a.target = '_blank';
      a.rel = 'noopener';
    });
    document.querySelector('.related-widget-wrapper[data-model-ref="project"] .add-related')?.remove();
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .us-collapsible-heading {
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        gap: .25em;
      }
      .us-collapsible-heading:hover {
        opacity: 0.8;
      }
      .us-collapsible.us-collapsed > *:not(.us-collapsible-heading) {
        display: none !important;
      }
      .us-collapse-arrow {
        display: inline-block;
        margin-right: 8px;
        transition: transform 0.15s ease;
      }
      .us-collapsed .us-collapse-arrow {
        transform: rotate(-90deg);
      }
      .us-entry-panel {
        border: 1px solid var(--border-color, #ccc);
        border-radius: 6px;
        padding: 10px 15px;
        margin-bottom: 15px;
        background: var(--darkened-bg, rgba(0, 0, 0, 0.02));
      }
      .us-entry-panel > h3 {
        margin-top: 0;
      }
      .us-entry-panel > h3.us-collapsible-heading .delete {
        margin-left: auto;
      }
      #log_entries-group h2 {
        text-transform: none;
      }
      .form-row.field-is_published.field-is_featured.field-is_spoiler .form-multiline {
        flex-direction: column;
        align-items: flex-start;
      }
      a.inlinechangelink {
        background: none !important;
        text-indent: 0 !important;
      }
      a.inlinechangelink img {
        vertical-align: middle;
        margin-left: 4px;
      }
      .us-asset-checklist {
        max-height: 240px;
        overflow-y: auto;
        border: 1px solid var(--border-color, #ccc);
        border-radius: 4px;
        padding: 6px 10px;
      }
      .us-asset-checkbox {
        padding: 3px 0;
      }
      /* The site's own CSS has the default/non-default submit button colors backwards -
         pin down the correct Django convention explicitly rather than rely on their cascade. */
      .submit-row input.us-save-button {
        text-transform: none !important;
        background: var(--default-button-bg, #417690) !important;
        color: var(--button-fg, #fff) !important;
      }
      .submit-row input.us-save-button:hover,
      .submit-row input.us-save-button:focus {
        background: var(--default-button-hover-bg, #205067) !important;
      }
      .submit-row input[name="_addanother"] {
        background: var(--button-bg, #79aec8) !important;
        color: var(--button-fg, #fff) !important;
      }
      .submit-row input[name="_addanother"]:hover,
      .submit-row input[name="_addanother"]:focus {
        background: var(--button-hover-bg, #417690) !important;
      }
      /* #container is height-constrained (likely height:100% for a sticky-footer layout on
         short pages) with overflow:visible, so long pages visually spill past it without
         clipping - but that also caps how far position:sticky can pin nav within it. Force it
         to size to its actual content instead. */
      #container {
        height: auto !important;
      }
      nav[aria-label="Breadcrumbs"] {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 12px;
        padding-right: 20px;
        background: var(--breadcrumbs-bg, #79aec8);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      }
      nav[aria-label="Breadcrumbs"] .breadcrumbs {
        flex: 1;
        min-width: 0;
        order: 1;
      }
      /* Header buttons (Artist Mode, View on site, Save) all reuse Django's own generic
         .button styling via classList, rather than us guessing at colors - this keeps them
         visually identical to "Save and add another" for free, backwards-color bug included. */
      .us-artist-mode-toggle {
        order: 2;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        white-space: nowrap;
        user-select: none;
      }
      nav[aria-label="Breadcrumbs"] a.viewsitelink {
        order: 3;
      }
      .us-header-save-button {
        order: 4;
      }
      /* View on site keeps Django's own more-specific .viewsitelink sizing (tuned for its
         original corner spot) even with .button added, so it renders smaller than the other
         two - force all three header buttons to the same explicit size instead of guessing
         which one is "right". */
      .us-artist-mode-toggle,
      nav[aria-label="Breadcrumbs"] a.viewsitelink,
      .us-header-save-button {
        padding: 4px 12px !important;
        font-size: 0.8125rem !important;
        line-height: 1.5 !important;
      }
      .us-toggle-input {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
      }
      .us-toggle-track {
        position: relative;
        display: inline-block;
        flex-shrink: 0;
        width: 34px;
        height: 18px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 9px;
        transition: background 0.15s ease;
      }
      .us-toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.15s ease;
      }
      .us-toggle-input:checked + .us-toggle-track {
        background: #4caf50;
      }
      .us-toggle-input:checked + .us-toggle-track .us-toggle-thumb {
        transform: translateX(16px);
      }
      .us-file-input-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .us-native-file-input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        overflow: hidden;
      }
      .us-artist-hidden {
        display: none;
      }
      body.us-dev-mode .us-artist-hidden {
        display: revert;
      }
      /* "display: revert" rolls back to the browser default (block for a div), skipping
         Django's own author-level ".flex-container { display: flex; }" - the other hidden
         fields are plain block .form-row divs so that's harmless, but this one IS a flex
         container itself, so it needs an explicit override instead. */
      body.us-dev-mode .fieldBox.field-render_thumbnails.us-artist-hidden {
        display: flex;
      }
    `;
    document.head.appendChild(style);
  }

  function safe(fn) {
    try {
      fn();
    } catch (e) {
      console.error('[Blender Studio Admin userscript]', fn.name, e);
    }
  }

  function init() {
    safe(injectStyles);
    safe(reorganizePreviewPanel);
    safe(cleanupPreviewFields);
    safe(cleanupFileInputs);
    safe(hideAssetViewLink);
    safe(hideDeleteRelatedLinks);
    safe(renameAssetCheckboxLabels);
    safe(cleanupTagsHelp);
    safe(cleanupDatePublished);
    safe(hideTopLevelAuthor);
    safe(cleanupProductionLogEntryFields);
    safe(hideRedundantPageTitle);
    safe(initArtistModeToggle);
    safe(initTopLevelPanels);
    safe(initEntries);
    safe(checkboxifyAssetSelectors);
    safe(fixRelatedWidgetLinks);
    safe(simplifySaveButtons);
    safe(relocateObjectTools);
    safe(addHeaderSaveButton);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Django's SelectFilter2 widgets init on window "load" (not DOMContentLoaded), and pages
  // with heavy images (e.g. production log thumbnails) can delay that well past when this
  // script first runs - so retry once everything has actually finished loading.
  window.addEventListener('load', () => safe(checkboxifyAssetSelectors));
  if (document.readyState === 'complete') {
    safe(checkboxifyAssetSelectors);
  }
})();
