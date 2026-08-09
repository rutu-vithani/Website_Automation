
(function () {
  function applyContent(data) {
    var editable = (data && data.editable) || {};
    Object.keys(editable).forEach(function (id) {
      var el = document.querySelector('[data-edit-id="' + id + '"]');
      if (!el) return;
      var item = editable[id];
      if (item.type === 'image') {
        if (el.hasAttribute('data-edit-bg')) {
          // CSS background-image tag: rewrite just the url(...) part of
          // the inline style, leaving any other declared styles alone.
          var style = el.getAttribute('style') || '';
          var next = style.replace(/background-image\s*:\s*url\([^)]*\)/i,
            'background-image:url(' + item.value + ')');
          el.setAttribute('style', next);
        } else {
          el.setAttribute('src', item.value);
          // Lazy-loaded images swap data-src into src via their own
          // script; keep data-src in sync too so a later re-run of that
          // lazy-load logic can't stomp the admin-edited image back to
          // the original placeholder URL.
          if (el.hasAttribute('data-src')) { el.setAttribute('data-src', item.value); }
          if (el.hasAttribute('data-lazy-src')) { el.setAttribute('data-lazy-src', item.value); }
        }
      } else {
        el.textContent = item.value;
      }
    });

    renderDetailCards((data && data.details) || []);
  }

  // The homepage HTML is static, so items added in the admin panel after
  // the site was generated (or removed there) need to be rendered in here
  // at load time. We clone the first "View Details" style card as a
  // template and reuse the site's own markup/classes for every detail
  // that doesn't already have a matching card in the page.
  function renderDetailCards(details) {
    var template = document.querySelector('[data-detail-template]');
    var container = document.querySelector('[data-details-list-container]');
    var existingIds = Array.prototype.map.call(
      document.querySelectorAll('[data-detail-id]'),
      function (el) { return el.getAttribute('data-detail-id'); }
    );
    var unrendered = details.filter(function (d) { return existingIds.indexOf(d.id) === -1; });
    if (!unrendered.length) return;

    if (template && container) {
      unrendered.forEach(function (detail) {
        var clone = template.cloneNode(true);
        clone.removeAttribute('data-detail-template');
        if (clone.hasAttribute('data-edit-id')) { clone.removeAttribute('data-edit-id'); }
        clone.querySelectorAll('[data-edit-id]').forEach(function (el) { el.removeAttribute('data-edit-id'); });

        var titleEl = clone.querySelector('h1, h2, h3, h4');
        if (titleEl) titleEl.textContent = detail.title || '';
        var descEl = clone.querySelector('p');
        if (descEl) descEl.textContent = detail.description || '';
        var imgEl = clone.querySelector('img');
        if (imgEl && detail.image) { imgEl.setAttribute('src', detail.image); imgEl.removeAttribute('data-src'); }
        var ctaEl = clone.querySelector('[data-detail-id]') || clone.querySelector('a, button');
        if (ctaEl) {
          ctaEl.setAttribute('data-detail-id', detail.id);
          if (ctaEl.tagName === 'A') { ctaEl.setAttribute('href', '/details/' + detail.id); }
        }
        container.appendChild(clone);
      });
      return;
    }

    // Fallback: this site has no existing "View Details" style card the
    // admin panel could learn a template from (e.g. a pure single-page
    // site with no repeating items). Rather than silently drop anything
    // added in the admin panel, render a simple generic section for it so
    // it's always visible somewhere on the live site.
    renderFallbackSection(unrendered);
  }

  function renderFallbackSection(items) {
    if (!document.getElementById('admin-added-items-style')) {
      var style = document.createElement('style');
      style.id = 'admin-added-items-style';
      style.textContent = '#admin-added-items{max-width:1100px;margin:48px auto;padding:0 24px}' +
        '#admin-added-items .aai-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}' +
        '#admin-added-items .aai-card{border:1px solid rgba(128,128,128,.25);border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;display:block}' +
        '#admin-added-items .aai-card img{width:100%;height:160px;object-fit:cover;display:block}' +
        '#admin-added-items .aai-card .aai-body{padding:14px}' +
        '#admin-added-items .aai-card h3{margin:0 0 6px;font-size:1.05rem}' +
        '#admin-added-items .aai-card p{margin:0;font-size:.9rem;opacity:.8}';
      document.head.appendChild(style);
    }

    var section = document.getElementById('admin-added-items');
    if (!section) {
      section = document.createElement('section');
      section.id = 'admin-added-items';
      var grid = document.createElement('div');
      grid.className = 'aai-grid';
      section.appendChild(grid);
      document.body.appendChild(section);
    }
    var grid = section.querySelector('.aai-grid');

    items.forEach(function (detail) {
      var card = document.createElement('a');
      card.className = 'aai-card';
      card.href = '/details/' + detail.id;
      card.setAttribute('data-detail-id', detail.id);
      var html = '';
      if (detail.image) { html += '<img src="' + detail.image.replace(/"/g, '&quot;') + '" alt="">'; }
      html += '<div class="aai-body"><h3></h3><p></p></div>';
      card.innerHTML = html;
      card.querySelector('h3').textContent = detail.title || '';
      card.querySelector('p').textContent = detail.description || '';
      grid.appendChild(card);
    });
  }

  fetch('/api/content')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) { if (data) applyContent(data); })
    .catch(function () {});
})();
