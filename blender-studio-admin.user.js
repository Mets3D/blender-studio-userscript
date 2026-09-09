// ==UserScript==
// @name         Blender Studio Admin: UX Tweaks
// @namespace    https://studio.blender.org/
// @version      2.42
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
    arrow.textContent = '▼';
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
    // Reflect the stored Artist Mode setting on <body> up front, so the dev/artist CSS still
    // works on pages with no breadcrumbs bar to host the toggle (e.g. related-object popups
    // like the Collection edit form).
    const storedArtistMode = localStorage.getItem(ARTIST_MODE_KEY) !== 'off';
    document.body.classList.toggle('us-dev-mode', !storedArtistMode);

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
              augmentAddAssetLinks();
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

  // Pull a Django help-text block (#<helpId>) off the page and re-attach its text as a hover
  // tooltip on the first element matching targetSelector. No-op (help left in place) if the
  // target isn't found.
  function moveHelpToTooltip(helpId, targetSelector) {
    const help = document.getElementById(helpId);
    const target = document.querySelector(targetSelector);
    if (!help || !target) return;
    const text = help.textContent.trim().replace(/\s+/g, ' ');
    if (text) target.title = text;
    help.remove();
  }

  // Add us-artist-hidden to a form row, and - if that leaves its fieldset with no visible
  // rows - to the whole fieldset too, so Artist Mode doesn't leave a bare heading behind.
  function hideRowFoldingEmptyFieldset(selector) {
    const row = document.querySelector(selector);
    if (!row) return;
    row.classList.add('us-artist-hidden');
    const fieldset = row.closest('fieldset.module');
    if (fieldset && !fieldset.querySelector('.form-row:not(.us-artist-hidden)')) {
      fieldset.classList.add('us-artist-hidden');
    }
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

    // Keep the removed help text around as a hover tooltip on the checkbox row.
    moveHelpToTooltip('id_contains_blend_file_helptext', '.form-row.field-contains_blend_file .checkbox-row');
  }

  function cleanupTagsHelp() {
    const help = document.getElementById('id_tags_helptext');
    const container = help?.querySelector(':scope > div');
    const tagLink = container?.querySelector('a[href="/admin/taggit/tag/"]');
    if (!container || !tagLink || !container.firstChild) return;

    // The help block is two sentences of prose followed by a link. None of the prose needs to
    // stay on screen: the "Start typing..." usage hints move to a hover tooltip on the tags
    // input itself, and the "Only existing tags..." caveat rides along on the link's tooltip.
    // What's left visible is just a tidy "Manage Tags" button.
    const prose = document.createRange();
    prose.setStartBefore(container.firstChild);
    prose.setEndBefore(tagLink);
    const fullText = prose.toString().replace(/\s+/g, ' ').trim();
    prose.deleteContents();

    const caveatStart = fullText.search(/Only existing tags/i);
    const usageText = (caveatStart === -1 ? fullText : fullText.slice(0, caveatStart)).trim();
    const caveatText = caveatStart === -1
      ? ''
      : fullText.slice(caveatStart).replace(/\s+at$/, ' here.').trim();

    const tagsBox = document.querySelector('.fieldBox.field-tags tags.tagify')
      || document.querySelector('.fieldBox.field-tags');
    if (tagsBox && usageText) tagsBox.title = usageText;

    tagLink.textContent = 'Manage Tags';
    tagLink.classList.add('button');
    if (caveatText) tagLink.title = caveatText;
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
    // Production-log only: the blog post form also has a top-level id_author, but there the
    // byline is the point, so don't touch it there.
    if (!location.pathname.includes('/projects/productionlog/')) return;
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

  function cleanupCollectionPage() {
    if (!location.pathname.includes('/projects/collection/')) return;

    // "Thumbnail aspect ratio": its one-line help becomes a hover tooltip on the field.
    moveHelpToTooltip('id_thumbnail_aspect_ratio_helptext', '.fieldBox.field-thumbnail_aspect_ratio');
    // Hide the column wrapper (a plain <div> that reverts cleanly under dev mode) rather than
    // the flex .fieldBox itself, which would need an explicit display override to come back.
    document.querySelector('.fieldBox.field-thumbnail_aspect_ratio')?.parentElement
      ?.classList.add('us-artist-hidden');

    // User/Order and Slug are dev-only here.
    hideRowFoldingEmptyFieldset('.form-row.field-user.field-order');
    hideRowFoldingEmptyFieldset('.form-row.field-slug');
  }

  function cleanupStaticAssetPage() {
    if (!location.pathname.includes('/static_assets/staticasset/')) return;

    // "Is free" -> "Free"; its help and the Author / Contributors help all become tooltips.
    const freeLabel = document.querySelector('label[for="id_is_free"]');
    if (freeLabel) freeLabel.textContent = 'Free';
    moveHelpToTooltip('id_is_free_helptext', '.form-row.field-is_free .checkbox-row');
    moveHelpToTooltip('id_author_helptext', '.fieldBox.field-author');
    moveHelpToTooltip('id_contributors_helptext', '.fieldBox.field-contributors');

    // "The fields below are only applicable to a video upload" etc. - redundant hand-holding.
    document.querySelectorAll('#staticasset_form fieldset .description').forEach((d) => d.remove());

    // Artist Mode strips this page down to the few fields worth an artist's attention: Source,
    // Free and Original filename here, plus Loop / Autoplay in the video fieldset. Everything
    // else is dev/debug detail.
    document.querySelector('.fieldBox.field-source_storage')?.parentElement
      ?.classList.add('us-artist-hidden');
    [
      '.form-row.field-id',
      '.form-row.field-size.field-size_bytes',
      '.form-row.field-source_type.field-content_type',
      '.form-row.field-user.field-author.field-contributors',
      '.form-row.field-license',
      '.form-row.field-thumbnail.field-render_thumbnails',
      '.form-row.field-date_created.field-view_count.field-download_count',
      '.form-row.field-linked_by',
      '.form-row.field-width.field-height.field-resolution_label',
      '.form-row.field-duration',
      '.form-row.field-metadata',
    ].forEach(hideRowFoldingEmptyFieldset);

    // Video variations / Video tracks are read-only transcode detail - fold the whole panels.
    ['variations-group', 'tracks-group'].forEach((id) => {
      document.getElementById(id)?.classList.add('us-artist-hidden');
    });
  }

  // Carve a flat fieldset into collapsible <fieldset> panels: each spec is [title, [field
  // names]], and the matching :scope > .form-row.field-<name> rows are moved into a new panel.
  // Returns the last panel built (or sourceFieldset if none were). initTopLevelPanels turns
  // them collapsible afterwards.
  function buildPanels(sourceFieldset, specs, extraClass) {
    let anchor = sourceFieldset;
    specs.forEach(([title, fields]) => {
      const panel = document.createElement('fieldset');
      panel.className = 'module aligned us-built-panel' + (extraClass ? ` ${extraClass}` : '');
      const h2 = document.createElement('h2');
      h2.textContent = title;
      panel.appendChild(h2);
      fields.forEach((name) => {
        const row = sourceFieldset.querySelector(`:scope > .form-row.field-${name}`);
        if (row) panel.appendChild(row);
      });
      if (panel.childElementCount > 1) {
        anchor.insertAdjacentElement('afterend', panel);
        anchor = panel;
      }
    });
    return anchor;
  }

  function cleanupPostPage() {
    const form = document.getElementById('post_form');
    if (!form) return;

    // "Is subscribers only" -> "Subscribers only" (is_featured / is_published are renamed by
    // renameAssetCheckboxLabels).
    const subLabel = document.querySelector('label[for="id_is_subscribers_only"]');
    if (subLabel) subLabel.textContent = 'Subscribers only';

    moveHelpToTooltip('id_excerpt_helptext', '.form-row.field-excerpt .flex-container');
    moveHelpToTooltip('id_contributors_helptext', '.fieldBox.field-contributors');

    // The post form ships as one long flat fieldset - carve it into our usual collapsible
    // panels. Every row is accounted for below, so the original fieldset ends up empty.
    const source = form.querySelector('fieldset.module');
    if (!source || form.querySelector('.us-built-panel')) return;

    buildPanels(source, [
      ['Content', ['title', 'excerpt', 'content']],
      ['Attachments', ['attachments', 'header', 'thumbnail']],
      // "author" is the .form-row.field-author.field-contributors row - it carries both.
      ['Organization', ['slug', 'project', 'training', 'category', 'tags',
        'is_featured', 'is_published', 'is_subscribers_only', 'date_published', 'author']],
    ], 'us-post-panel');

    if (!source.querySelector('.form-row')) source.remove();
  }

  // Column-header text of a tabular inline, keyed by the "field-<name>" class used on the body
  // cells, so a rebuilt row can label its fields exactly like Django would.
  function sectionColumnLabels(group) {
    const map = {};
    group.querySelectorAll('thead th').forEach((th) => {
      const cls = [...th.classList].find((c) => c.startsWith('column-'));
      if (cls) map['field-' + cls.slice(7)] = th.textContent.trim().replace(/\s+/g, ' ');
    });
    return map;
  }

  // Wrap one field's widget in Django's native aligned .form-row inner markup
  // (<div><div class="flex-container"><label> <widget></div></div>) and return the wrapper.
  // Everything in `source` (the widget included) is MOVED into it.
  function buildSectionFieldInner(source, labelText, widget) {
    const inner = document.createElement('div');
    const flex = document.createElement('div');
    flex.className = 'flex-container';
    if (widget && widget.type === 'checkbox') {
      flex.classList.add('checkbox-row');
      while (source.firstChild) flex.appendChild(source.firstChild);
      const lab = document.createElement('label');
      lab.className = 'vCheckboxLabel';
      if (widget.id) lab.htmlFor = widget.id;
      lab.textContent = labelText;
      flex.appendChild(lab);
    } else {
      const lab = document.createElement('label');
      lab.textContent = labelText + ':';
      if (widget && widget.id) lab.htmlFor = widget.id;
      flex.appendChild(lab);
      while (source.firstChild) flex.appendChild(source.firstChild);
    }
    inner.appendChild(flex);
    return inner;
  }

  // Collect a row's field cells into one native <fieldset class="module aligned"> of .form-row
  // rows (Django's exact stacked-inline markup). Each td's widget is MOVED into its row.
  function buildSectionFieldset(fieldTds, labels) {
    const fs = document.createElement('fieldset');
    fs.className = 'module aligned';
    fieldTds.forEach((td) => {
      const cls = [...td.classList].find((c) => c.startsWith('field-'));
      const widget = td.querySelector('input, select, textarea');
      const row = document.createElement('div');
      row.className = 'form-row ' + cls;
      row.appendChild(buildSectionFieldInner(td, labels[cls] || cls.slice(6), widget));
      fs.appendChild(row);
    });
    return fs;
  }

  // Rebuild one saved row into a native stacked-inline panel (.inline-related + a
  // .module.aligned fieldset of .form-row rows), so it inherits the real admin styling and
  // reads like a production-log entry. The gutted <tr> stays in the table (hidden) carrying
  // its <prefix>-N-id / -<parent> hidden inputs, so Django's bookkeeping is untouched.
  function buildSectionPanel(tr, labels) {
    if (tr.dataset.usSection) return;
    tr.dataset.usSection = 'true';

    const orig = tr.querySelector(':scope > td.original');
    const table = tr.closest('table');
    if (!orig || !table) return;

    const panel = document.createElement('div');
    panel.className = 'inline-related has_original us-section us-entry-panel';

    const h3 = document.createElement('h3');
    const inlineLabel = document.createElement('span');
    inlineLabel.className = 'inline_label';
    const p = orig.querySelector('p');
    if (p) while (p.firstChild) inlineLabel.appendChild(p.firstChild);
    h3.appendChild(inlineLabel);
    const viewLink = inlineLabel.querySelector('a:not(.inlinechangelink)');
    if (viewLink) h3.appendChild(viewLink);

    const cb = tr.querySelector(':scope > td.delete input[type="checkbox"]');
    if (cb) {
      const del = document.createElement('span');
      del.className = 'delete';
      const dl = document.createElement('label');
      dl.className = 'vCheckboxLabel inline';
      if (cb.id) dl.htmlFor = cb.id;
      dl.textContent = 'Delete';
      del.append(cb, ' ', dl);
      h3.appendChild(del);
    }

    panel.append(h3, buildSectionFieldset([...tr.querySelectorAll(':scope > td[class*="field-"]')], labels));
    table.parentNode.insertBefore(panel, table);
    tr.classList.add('us-section-tr-hidden');

    iconifyChangeLink(h3);
    makeCollapsible(panel, h3, location.pathname + '::section::' + tr.id);
  }

  // A freshly-added row is renumbered by Django on remove, so its widgets have to stay inside
  // the <tr>. Build the same native markup as a saved panel (an <h3> in td.original, one
  // fieldset of .form-row rows parked in the first field cell) so the styling matches exactly;
  // the <tr> itself gets .inline-related + .us-entry-panel to be the panel.
  function stackNewSectionRow(tr, labels, itemName) {
    if (tr.dataset.usSection) return;
    tr.dataset.usSection = 'true';
    tr.classList.add('inline-related', 'us-section', 'us-entry-panel', 'us-section-new');

    const orig = tr.querySelector(':scope > td.original');
    if (!orig) return;
    orig.querySelector('p:empty')?.remove();

    let h3 = orig.querySelector(':scope > h3');
    if (!h3) {
      h3 = document.createElement('h3');
      const label = document.createElement('span');
      label.className = 'inline_label';
      label.textContent = `New ${itemName || 'section'}`;
      h3.appendChild(label);
      const remove = tr.querySelector(':scope > td.delete a.inline-deletelink');
      if (remove) {
        const span = document.createElement('span');
        span.className = 'delete';
        span.appendChild(remove);
        h3.appendChild(span);
      }
      orig.prepend(h3);
    }

    const fieldTds = [...tr.querySelectorAll(':scope > td[class*="field-"]')];
    if (fieldTds[0] && !fieldTds[0].querySelector('fieldset')) {
      fieldTds[0].appendChild(buildSectionFieldset(fieldTds, labels));
    }

    makeCollapsible(tr, h3, location.pathname + '::section::' + tr.id);
  }

  function processSectionRow(tr, labels, itemName) {
    if (tr.classList.contains('has_original')) buildSectionPanel(tr, labels);
    else stackNewSectionRow(tr, labels, itemName);
  }

  // Turn a wide tabular inline (Sections on /chapter/, Chapters on /training/) into a column
  // of native stacked-inline panels: drop Django's blank extra forms (that's what the "Add
  // another" button is for), rebuild the saved rows, and restyle freshly-added rows in place.
  function rebuildTabularInline(group) {
    group.classList.add('us-tabular-stacked');
    const prefix = group.id.replace(/-group$/, '');
    const itemName = prefix.replace(/s$/, '');   // "chapters" -> "chapter", "sections" -> "section"
    const total = document.getElementById(`id_${prefix}-TOTAL_FORMS`);
    const initial = document.getElementById(`id_${prefix}-INITIAL_FORMS`);
    if (total && initial) {
      group.querySelectorAll(`tr.dynamic-${prefix}:not(.has_original)`).forEach((tr) => tr.remove());
      total.value = initial.value;
    }
    const labels = sectionColumnLabels(group);
    group.querySelectorAll(`tr.dynamic-${prefix}`).forEach((tr) => processSectionRow(tr, labels, itemName));

    const tbody = group.querySelector('tbody');
    if (!tbody) return;
    new MutationObserver((muts) => {
      muts.forEach((m) => m.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.matches && node.matches(`tr.dynamic-${prefix}`)) {
          processSectionRow(node, labels, itemName);
        }
      }));
    }).observe(tbody, { childList: true });
  }

  function cleanupChapterPage() {
    const form = document.getElementById('chapter_form');
    if (!form) return;

    const source = form.querySelector('fieldset.module');
    if (source && !form.querySelector('.us-built-panel')) {
      const lastPanel = buildPanels(source, [
        ['Content', ['name', 'description']],
        ['Attachments', ['picture_header', 'thumbnail']],
        ['Organization', ['training', 'index', 'slug', 'is_published', 'user']],
      ]);
      // Every chapter field is placed above, so the stub fieldset should end up empty; if some
      // unexpected row is left, park the stub below the panels instead of on top.
      if (!source.querySelector('.form-row')) source.remove();
      else if (lastPanel !== source) lastPanel.insertAdjacentElement('afterend', source);
    }
    document.querySelector('#chapter_form .form-row.field-user')?.classList.add('us-artist-hidden');

    const group = document.getElementById('sections-group');
    if (group) rebuildTabularInline(group);
  }

  function cleanupTrainingPage() {
    const form = document.getElementById('training_form');
    if (!form) return;

    moveHelpToTooltip('id_description_helptext', '.form-row.field-description .flex-container');
    moveHelpToTooltip('id_show_blog_posts_helptext', '.form-row.field-show_blog_posts .checkbox-row');

    const source = form.querySelector('fieldset.module');
    if (source && !form.querySelector('.us-built-panel')) {
      const lastPanel = buildPanels(source, [
        ['Content', ['name', 'description', 'summary']],
        ['Attachments', ['picture_header', 'thumbnail', 'preview_video']],
        ['Organization', ['slug', 'type', 'difficulty', 'tags', 'is_featured', 'is_published',
          'show_blog_posts', 'date_created', 'date_updated']],
      ]);
      if (!source.querySelector('.form-row')) source.remove();
      else if (lastPanel !== source) lastPanel.insertAdjacentElement('afterend', source);
    }
    // Read-only timestamps are dev noise.
    ['field-date_created', 'field-date_updated'].forEach((cls) => {
      document.querySelector(`#training_form .form-row.${cls}`)?.classList.add('us-artist-hidden');
    });

    const group = document.getElementById('chapters-group');
    if (group) rebuildTabularInline(group);
  }

  function dropRedundantTopSubmitRow() {
    // Admins with save_on_top (e.g. blog Post) render a second .submit-row above the form.
    // It duplicates the bottom one and the pinned-header Save button - drop it so only the
    // bottom row is left for simplifySaveButtons / relocateObjectTools to work on.
    const rows = document.querySelectorAll('.submit-row');
    if (rows.length > 1) rows[0].remove();
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

  function augmentAddAssetLinks() {
    // Tag "Add another asset" links with our own custom params (not real field names, so
    // Django's own GET-param initial-data logic just ignores them) - read on the asset add
    // page itself and applied directly via JS, sidestepping Django's initial-data handling for
    // the split date/time widget, which crashes if handed a plain string via that mechanism.
    const projectValue = document.querySelector('#id_project')?.value;
    const startDateValue = document.querySelector('#id_start_date')?.value;

    let earlierDate = null;
    if (startDateValue) {
      const d = new Date(startDateValue + 'T00:00:00');
      if (!isNaN(d)) {
        d.setDate(d.getDate() - 3);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        earlierDate = `${y}-${m}-${day}`;
      }
    }

    document.querySelectorAll('.related-widget-wrapper[data-model-ref="asset"] a.add-related').forEach((a) => {
      if (a.dataset.usAugmented) return;
      a.dataset.usAugmented = 'true';
      const url = new URL(a.href, location.origin);
      if (projectValue) url.searchParams.set('_us_project', projectValue);
      url.searchParams.set('_us_category', 'artwork');
      url.searchParams.set('_us_is_published', '1');
      if (earlierDate) url.searchParams.set('_us_date', earlierDate);
      a.href = url.toString();
    });
  }

  function applyAssetAddDefaults() {
    if (!location.pathname.includes('/projects/asset/add/')) return;
    const params = new URLSearchParams(location.search);

    const project = params.get('_us_project');
    if (project) {
      const select = document.getElementById('id_project');
      if (select) select.value = project;
    }

    const category = params.get('_us_category');
    if (category) {
      const select = document.getElementById('id_category');
      if (select) select.value = category;
    }

    if (params.get('_us_is_published') === '1') {
      const checkbox = document.getElementById('id_is_published');
      if (checkbox) checkbox.checked = true;
    }

    const date = params.get('_us_date');
    if (date) {
      const dateInput = document.getElementById('id_date_published_0');
      if (dateInput) dateInput.value = date;
    }
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
      /* Bigger, solider chevron - closer to Django's own native <details> panel marker. */
      .us-collapse-arrow {
        display: inline-block;
        margin-right: 8px;
        font-size: 1.2em;
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
      /* Django upper-cases every panel heading (fieldset headings, inline-group headings, our
         own built panels) - drop that. ID-level specificity so it still wins the cascade. The
         native <details> Metadata panel is untouched (its h2 isn't a direct fieldset child). */
      #content-main fieldset.module > h2,
      #content-main .inline-group h2 {
        text-transform: none;
      }
      /* nested_admin's inline groups carry a large vertical margin that leaves an oversized
         gap between stacked panels (e.g. Video variations -> Video tracks). */
      #content-main .inline-group {
        margin: 8px 0 !important;
      }
      /* These forms are carved into lots of single-field fieldsets, and Django's stock ~20px
         gap under every one reads as an oversized band of whitespace below each separator
         line. Tighten it across all change forms. */
      #content-main fieldset.module {
        margin-bottom: 8px !important;
      }
      /* Single-column layout everywhere: Django lays multi-field rows out side by side, which
         is cramped on these forms. Stack every multi-field row so the second field (Parent,
         Order, Resized/cropped, Thumbnail aspect ratio, Collection, Tags, ...) drops below
         the first instead of beside it. */
      .form-row .form-multiline {
        flex-direction: column !important;
        align-items: flex-start !important;
      }
      /* Post panels: keep row separators only where the grouping needs them (Tags | Featured,
         Subscribers only | Date published, Excerpt | Content) and drop the rest. Scoped to our
         own built .us-post-panel, so no other page's rows are affected. */
      .us-post-panel .form-row:not(.field-tags):not(.field-is_subscribers_only):not(.field-excerpt) {
        border-bottom: none !important;
      }
      /* Tabular inlines (Sections on /chapter/, Chapters on /training/): rebuildTabularInline
         turns each into a column of stacked-inline panels. Saved rows become real
         .inline-related divs; freshly-added rows are dressed up in place (Django renumbers
         them, so their widgets have to stay in the <tr>) - the <tr> becomes the panel, an
         <h3> goes in td.original, and the fields are collected into one native fieldset in
         the first cell. So the only thing to style here is the leftover <table> chrome. */
      #content-main .us-tabular-stacked thead,
      #content-main .us-tabular-stacked tr.us-section-tr-hidden,
      #content-main .us-tabular-stacked tr.empty-form,
      #content-main .us-tabular-stacked tr.us-section-new > td:empty,
      #content-main .us-tabular-stacked tr.us-section-new > td.delete,
      #content-main .us-tabular-stacked tr.us-section-new > td.original > input[type="hidden"] {
        display: none;
      }
      #content-main .us-tabular-stacked table {
        display: block;
        width: auto;
      }
      #content-main .us-tabular-stacked tbody,
      #content-main .us-tabular-stacked tr.add-row,
      #content-main .us-tabular-stacked tr.add-row > td {
        display: block;
      }
      /* The in-place <tr> IS the panel. !important + ID specificity beats Django's tabular
         .row1/.row2 zebra (which otherwise boxes every other row once the <tr> is block). */
      #content-main .us-tabular-stacked tr.us-section-new {
        display: block;
        width: auto;
        margin: 0 0 15px !important;
        padding: 10px 15px;
        border: 1px solid var(--border-color, #ccc) !important;
        border-radius: 6px;
        outline: 0 !important;
        box-shadow: none !important;
        background: var(--darkened-bg, rgba(0, 0, 0, 0.02));
      }
      #content-main .us-tabular-stacked tr.us-section-new > td {
        display: block;
        width: auto;
        border: 0;
        outline: 0;
        padding: 0;
      }
      #content-main .us-tabular-stacked tr.us-section-new > td.original > h3 {
        margin-top: 0;
      }
      /* The <h3> heading lives inside td.original (can't be a direct <tr> child), so keep the
         whole cell visible when the row is collapsed. */
      #content-main .us-tabular-stacked tr.us-section-new.us-collapsed > td.original {
        display: block !important;
      }
      /* Per-row fields that are dev noise in Artist Mode. .us-section scopes this to rebuilt
         inline rows (Sections + Chapters); each page only renders the field classes it has. */
      body:not(.us-dev-mode) .us-section .form-row.field-user,
      body:not(.us-dev-mode) .us-section .form-row.field-attachments,
      body:not(.us-dev-mode) .us-section .form-row.field-preview_youtube_link,
      body:not(.us-dev-mode) .us-section .form-row.field-picture_header,
      body:not(.us-dev-mode) .us-section .form-row.field-thumbnail {
        display: none !important;
      }
      /* Collapse the row-to-row gap so Published/Featured/Spoiler and "Contains .blend" read
         as one group - the next row already zeroes its own padding-top to match. */
      .form-row.field-is_published.field-is_featured.field-is_spoiler {
        border-bottom: none !important;
        padding-bottom: 0 !important;
      }
      .form-row.field-contains_blend_file {
        border-top: none !important;
        padding-top: 0 !important;
      }
      /* Checkbox + label rows don't vertically center by default. */
      .checkbox-row {
        align-items: center !important;
      }
      /* Even centered as boxes, the label's text glyphs still sit visually lower than the
         checkbox - nudge the text up directly rather than fighting box alignment further.
         Scoped to .checkbox-row so it doesn't also shift inline .vCheckboxLabel toggles that
         live outside a checkbox row (e.g. the "Delete" toggle on log-entry headings). */
      .checkbox-row .vCheckboxLabel {
        position: relative;
        top: -4px;
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
      /* !important throughout: "hidden" has to beat higher-specificity Django rules such as
         "fieldset.collapse" on the native <details> Metadata panel. */
      .us-artist-hidden {
        display: none !important;
      }
      body.us-dev-mode .us-artist-hidden {
        display: revert !important;
      }
      /* "display: revert" rolls back to the browser default (block for a div), skipping
         Django's own author-level ".flex-container { display: flex; }" - the other hidden
         fields are plain block .form-row divs so that's harmless, but this one IS a flex
         container itself, so it needs an explicit override instead. */
      body.us-dev-mode .fieldBox.field-render_thumbnails.us-artist-hidden {
        display: flex !important;
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
    safe(cleanupPostPage);
    safe(cleanupPreviewFields);
    safe(cleanupFileInputs);
    safe(hideAssetViewLink);
    safe(hideDeleteRelatedLinks);
    safe(renameAssetCheckboxLabels);
    safe(cleanupTagsHelp);
    safe(cleanupDatePublished);
    safe(hideTopLevelAuthor);
    safe(cleanupProductionLogEntryFields);
    safe(cleanupCollectionPage);
    safe(cleanupStaticAssetPage);
    safe(cleanupChapterPage);
    safe(cleanupTrainingPage);
    safe(hideRedundantPageTitle);
    safe(initArtistModeToggle);
    safe(initTopLevelPanels);
    safe(initEntries);
    safe(checkboxifyAssetSelectors);
    safe(augmentAddAssetLinks);
    safe(applyAssetAddDefaults);
    safe(fixRelatedWidgetLinks);
    safe(dropRedundantTopSubmitRow);
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
