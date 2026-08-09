
(function () {
  var id = window.location.pathname.split('/').filter(Boolean).pop();
  var container = document.getElementById('details-content');

  fetch('/api/details/' + encodeURIComponent(id))
    .then(function (r) { if (!r.ok) throw new Error('not found'); return r.json(); })
    .then(function (detail) { render(detail); })
    .catch(function () { renderNotFound(); });

  function render(detail) {
    var html = '';
    if (detail.image) {
      html += '<img class="details-image" src="' + escapeAttr(detail.image) + '" alt="' + escapeAttr(detail.title || '') + '">';
    }
    html += '<h1>' + escapeHtml(detail.title || '') + '</h1>';
    if (detail.description) {
      html += '<p>' + escapeHtml(detail.description) + '</p>';
    }
    var extraKeys = Object.keys(detail.extra || {});
    if (extraKeys.length) {
      html += '<div class="details-extra"><dl>';
      extraKeys.forEach(function (key) {
        html += '<dt>' + escapeHtml(key) + '</dt><dd>' + escapeHtml(detail.extra[key]) + '</dd>';
      });
      html += '</dl></div>';
    }
    container.innerHTML = html;
  }

  function renderNotFound() {
    container.innerHTML = '<div class="details-notfound"><h1>Not found</h1><p>This item is not available.</p></div>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
