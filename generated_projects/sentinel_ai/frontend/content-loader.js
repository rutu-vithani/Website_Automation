
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
    applyCustomFields((data && data.custom_fields) || {});
  }

  // Custom fields added per-section from the Admin Panel ("+ Add field")
  // are rendered as a small key/value list appended to the bottom of that
  // section on the live page, so anything added in the admin actually
  // shows up on the site.
  function applyCustomFields(customFields) {
    Object.keys(customFields).forEach(function (sid) {
      var fields = (customFields[sid] || []).filter(function (f) {
        return f && (f.label || f.value);
      });
      var section = document.querySelector('[data-section-id="' + sid + '"]');
      if (!section) return;

      var block = section.querySelector(':scope > .admin-custom-field-block');
      if (!fields.length) {
        if (block) block.remove();
        return;
      }
      if (!block) {
        block = document.createElement('div');
        block.className = 'admin-custom-field-block';
        section.appendChild(block);
      }
      block.innerHTML = '';
      fields.forEach(function (f) {
        var row = document.createElement('div');
        row.className = 'admin-custom-field-row';
        if (f.label) {
          var label = document.createElement('span');
          label.className = 'admin-custom-field-label';
          label.textContent = f.label + ': ';
          row.appendChild(label);
        }
        var value = document.createElement('span');
        value.className = 'admin-custom-field-value';
        value.textContent = f.value || '';
        row.appendChild(value);
        block.appendChild(row);
      });
    });
  }

  fetch('/api/content')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) { if (data) applyContent(data); })
    .catch(function () {});
})();
