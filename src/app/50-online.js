// HT.app, part 50: Opt-in online content for the panel: summary, image, museum object.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // --- Opt-in Wikimedia image (the only network access the page ever makes, and only when switched on) ---
  function loadImageCache() {
    if (imageCache) return imageCache;
    imageCache = {};
    try { const raw = JSON.parse(root.localStorage.getItem(IMAGE_CACHE_KEY) || '{}'); if (raw && typeof raw === 'object') imageCache = raw; } catch (err) { /* ignore */ }
    try { root.localStorage.removeItem('ht-image-cache'); } catch (err) { /* the pre-summary cache, no longer read */ }
    return imageCache;
  }

  function saveImageCache() {
    try {
      const keys = Object.keys(imageCache);
      if (keys.length > IMAGE_CACHE_MAX) keys.slice(0, keys.length - IMAGE_CACHE_MAX).forEach(function (k) { delete imageCache[k]; });
      root.localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(imageCache));
    } catch (err) { /* storage full or unavailable */ }
  }

  function stripTags(html) {
    return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // One summary request per opened event gives both the thumbnail and a paragraph of text. The result is
  // { x?: extract, src?, page?, credit? } or 0 when the article offers neither.
  async function fetchEventSummary(title) {
    const res = await root.fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title), {
      headers: { 'Api-User-Agent': API_UA }, credentials: 'omit', referrerPolicy: 'no-referrer'
    });
    if (!res.ok) return 0;
    const sum = await res.json();
    const extract = sum && sum.type !== 'disambiguation' && typeof sum.extract === 'string' ? sum.extract.trim().slice(0, 900) : '';
    const thumb = sum && sum.thumbnail && sum.thumbnail.source;
    const orig = sum && sum.originalimage && sum.originalimage.source;
    // Only freely licensed files live on Commons; images under /wikipedia/en/ are fair-use and are not shown.
    // The file name sits after the two hash directories; "originalimage" may itself be a thumb URL with a query.
    const m = /\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^\/?#]+)/.exec(orig || '');
    if (!thumb || !m) return extract ? { x: extract } : 0;
    let file = m[1];
    try { file = decodeURIComponent(file); } catch (err) { /* keep raw */ }
    const out = { x: extract, src: thumb, page: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file), credit: 'Wikimedia Commons' };
    try {
      const meta = await root.fetch('https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&format=json&origin=*&titles=' +
        encodeURIComponent('File:' + file), { credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (meta.ok) {
        const pages = ((await meta.json()).query || {}).pages || {};
        const info = pages[Object.keys(pages)[0]];
        const em = info && info.imageinfo && info.imageinfo[0] && info.imageinfo[0].extmetadata;
        if (em) {
          const artist = stripTags(em.Artist && em.Artist.value).slice(0, 60);
          const lic = stripTags(em.LicenseShortName && em.LicenseShortName.value).slice(0, 30);
          out.credit = [artist, lic].filter(Boolean).join(' · ') + ' · Wikimedia Commons';
        }
      }
    } catch (err) { /* keep the generic credit */ }
    return out;
  }

  function showPanelImage(img, ev) {
    if (!img || !img.src) { dom.panelImage.hidden = true; dom.panelImg.removeAttribute('src'); return; }
    dom.panelImg.src = img.src;
    dom.panelImg.alt = ev.title;
    dom.panelImgLink.href = img.page;
    dom.panelImgCredit.textContent = img.credit;
    dom.panelImage.hidden = false;
  }

  // The article's opening paragraph, shown only when it says more than the event's own detail does.
  function showPanelExtract(rec, ev) {
    if (!dom.panelExtract) return;
    const text = C.trimExtract(rec && typeof rec.x === 'string' ? rec.x : '');
    if (!text || text.length < 80 || typeof ev.link !== 'string') { dom.panelExtract.hidden = true; dom.panelExtractText.textContent = ''; return; }
    dom.panelExtractText.textContent = text;
    dom.panelExtractSrc.href = ev.link;
    dom.panelExtract.hidden = false;
  }

  function updatePanelImage(ev) {
    if (!dom.panelImage) return;
    const seq = ++imageSeq;
    showPanelImage(null, ev);
    showPanelExtract(null, ev);
    if (!imagesOn || typeof root.fetch !== 'function' || typeof ev.link !== 'string' || ev.link.indexOf(WIKI_PREFIX) !== 0) return;
    let title = ev.link.slice(WIKI_PREFIX.length);
    try { title = decodeURIComponent(title); } catch (err) { /* keep raw */ }
    const cache = loadImageCache();
    if (Object.prototype.hasOwnProperty.call(cache, title)) { showPanelImage(cache[title] || null, ev); showPanelExtract(cache[title] || null, ev); return; }
    fetchEventSummary(title).then(function (rec) {
      cache[title] = rec || 0;
      saveImageCache();
      if (seq === imageSeq && imagesOn) { showPanelImage(rec || null, ev); showPanelExtract(rec || null, ev); }
    }).catch(function () { /* offline or blocked: the panel simply has no image */ });
  }

  // --- Museum object: a text link always (no network); its image only with the opt-in ---
  function updatePanelObject(ev) {
    if (!dom.panelObject) return;
    const found = HT.objects && HT.objects[ev.title];
    const isHttps = function (u) { return typeof u === 'string' && /^https:\/\//.test(u); };
    const obj = found && isHttps(found.url) ? found : null;   // same rule as the Read more link: https only
    if (!obj) { dom.panelObject.hidden = true; dom.panelObjectImg.removeAttribute('src'); return; }
    dom.panelObjectLink.textContent = obj.title + (obj.maker ? ', ' + obj.maker : '') + (obj.date ? ' (' + obj.date + ')' : '') + ' \u2197';
    dom.panelObjectLink.href = obj.url;
    dom.panelObjectCredit.textContent = obj.credit;
    if (imagesOn && isHttps(obj.img)) {
      dom.panelObjectImg.src = obj.img;
      dom.panelObjectImg.alt = obj.title;
      dom.panelObjectImgLink.href = obj.url;
      dom.panelObjectImgLink.hidden = false;
    } else {
      dom.panelObjectImg.removeAttribute('src');
      dom.panelObjectImgLink.hidden = true;
    }
    dom.panelObject.hidden = false;
  }

  function setImages(on) {
    imagesOn = !!on;
    try { root.localStorage.setItem(IMAGES_KEY, imagesOn ? '1' : '0'); } catch (err) { /* ignore */ }
    if (dom && dom.optImages) dom.optImages.checked = imagesOn;
    if (dom && !dom.panel.hidden && selected >= 0) { updatePanelImage(events()[selected]); updatePanelObject(events()[selected]); }
    if (dom && shown) render();                          // on-this-day events appear or leave with the switch
  }
