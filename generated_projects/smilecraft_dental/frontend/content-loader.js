
(function () {
  function applyContent(data) {
    var editable = (data && data.editable) || {};
    Object.keys(editable).forEach(function (id) {
      var el = document.querySelector('[data-edit-id="' + id + '"]');
      if (!el) return;
      var item = editable[id];
      if (item.type === 'image') {
        el.setAttribute('src', item.value);
      } else {
        el.textContent = item.value;
      }
    });
  }

  fetch('/api/content')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) { if (data) applyContent(data); })
    .catch(function () {});
})();
