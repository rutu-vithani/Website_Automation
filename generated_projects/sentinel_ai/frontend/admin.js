
(function () {
  var loginScreen = document.getElementById('login-screen');
  var dashboard = document.getElementById('dashboard');
  var loginForm = document.getElementById('login-form');
  var loginError = document.getElementById('login-error');
  var contentList = document.getElementById('content-list');
  var detailsList = document.getElementById('details-list');
  var saveBtn = document.getElementById('save-btn');
  var saveStatus = document.getElementById('save-status');
  var logoutBtn = document.getElementById('logout-btn');
  var addDetailBtn = document.getElementById('add-detail-btn');

  var state = { editable: {}, details: [], sections: [], custom_fields: {} };

  function showDashboard() {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    loadContent();
  }

  function showLogin() {
    loginScreen.hidden = false;
    dashboard.hidden = true;
  }

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var password = document.getElementById('password').value;
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          loginError.hidden = true;
          showDashboard();
        } else {
          loginError.hidden = false;
        }
      })
      .catch(function () { loginError.hidden = false; });
  });

  logoutBtn.addEventListener('click', function () {
    fetch('/api/admin/logout', { method: 'POST' }).finally(showLogin);
  });

  document.querySelectorAll('.admin-tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var tab = btn.getAttribute('data-tab');
      document.getElementById('tab-content').hidden = tab !== 'content';
      document.getElementById('tab-details').hidden = tab !== 'details';
    });
  });

  function loadContent() {
    fetch('/api/admin/content')
      .then(function (r) {
        if (r.status === 401) { showLogin(); throw new Error('unauth'); }
        return r.json();
      })
      .then(function (data) {
        state = data;
        renderContent();
        renderDetails();
      })
      .catch(function () {});
  }

  // Renders one collapsible group per on-page section (Header, Navigation,
  // About, Footer, ...) instead of one giant flat list, so it's easy to
  // find the right place to edit. Each group also gets its own
  // "+ Add field" control to add a custom field to just that section.
  function renderContent() {
    contentList.innerHTML = '';
    state.sections = state.sections || [];
    state.custom_fields = state.custom_fields || {};

    var knownIds = {};
    state.sections.forEach(function (s) { knownIds[s.id] = true; });

    var order = state.sections.map(function (s) { return s.id; });
    var groups = {};
    order.forEach(function (id) { groups[id] = []; });

    Object.keys(state.editable || {}).forEach(function (id) {
      var item = state.editable[id];
      var sid = (item.section_id && knownIds[item.section_id]) ? item.section_id : 'other';
      if (!groups[sid]) { groups[sid] = []; order.push(sid); }
      groups[sid].push(id);
    });

    // sections that only have custom fields (no editable page items yet)
    Object.keys(state.custom_fields).forEach(function (sid) {
      if (!groups[sid]) { groups[sid] = []; order.push(sid); }
    });

    order.forEach(function (sid, idx) {
      if (!groups[sid]) return;
      var meta = state.sections.filter(function (s) { return s.id === sid; })[0];
      var label = meta ? meta.label : (sid === 'other' ? 'Other content' : sid);
      contentList.appendChild(buildSectionGroup(sid, label, groups[sid], idx === 0));
    });
  }

  function buildSectionGroup(sid, label, itemIds, openByDefault) {
    var group = document.createElement('div');
    group.className = 'admin-section-group' + (openByDefault ? ' open' : '');

    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'admin-section-head';

    var titleSpan = document.createElement('span');
    titleSpan.className = 'admin-section-title';
    titleSpan.textContent = label;

    var countSpan = document.createElement('span');
    countSpan.className = 'admin-section-count';
    countSpan.textContent = itemIds.length + (itemIds.length === 1 ? ' item' : ' items');

    var caretSpan = document.createElement('span');
    caretSpan.className = 'admin-section-caret';
    caretSpan.textContent = '▾';

    head.appendChild(titleSpan);
    head.appendChild(countSpan);
    head.appendChild(caretSpan);
    head.addEventListener('click', function () { group.classList.toggle('open'); });
    group.appendChild(head);

    var body = document.createElement('div');
    body.className = 'admin-section-body';

    var itemsWrap = document.createElement('div');
    itemsWrap.className = 'admin-list';
    itemIds.forEach(function (id) { itemsWrap.appendChild(buildContentItem(id)); });
    body.appendChild(itemsWrap);

    state.custom_fields[sid] = state.custom_fields[sid] || [];
    var customLabel = document.createElement('div');
    customLabel.className = 'admin-item-label admin-custom-fields-label';
    customLabel.textContent = 'Custom fields for this section';
    body.appendChild(customLabel);

    var customWrap = document.createElement('div');
    customWrap.className = 'admin-extra-fields';

    function renderCustom() {
      customWrap.innerHTML = '';
      state.custom_fields[sid].forEach(function (field) {
        customWrap.appendChild(buildCustomFieldRow(sid, field, renderCustom));
      });
    }
    renderCustom();
    body.appendChild(customWrap);

    var addFieldBtn = document.createElement('button');
    addFieldBtn.type = 'button';
    addFieldBtn.className = 'admin-small-btn admin-add-field-btn';
    addFieldBtn.textContent = '+ Add field';
    addFieldBtn.addEventListener('click', function () {
      state.custom_fields[sid].push({
        id: 'field-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        label: 'New field',
        value: '',
      });
      renderCustom();
    });
    body.appendChild(addFieldBtn);

    group.appendChild(body);
    return group;
  }

  function buildContentItem(id) {
    var item = state.editable[id];
    var row = document.createElement('div');
    row.className = 'admin-item';

    if (item.type === 'image') {
      var img = document.createElement('img');
      img.className = 'admin-preview';
      img.src = item.value;
      row.appendChild(img);
    }

    var body = document.createElement('div');
    body.className = 'admin-item-body';
    var label = document.createElement('div');
    label.className = 'admin-item-label';
    label.textContent = item.label || id;
    body.appendChild(label);

    var input;
    if (item.type === 'image') {
      input = document.createElement('input');
      input.type = 'url';
      input.placeholder = 'Image URL';
    } else {
      input = document.createElement('textarea');
      input.rows = text_rows(item.value);
    }
    input.value = item.value;
    input.addEventListener('input', function () {
      state.editable[id].value = input.value;
      if (item.type === 'image') { row.querySelector('img').src = input.value; }
    });
    body.appendChild(input);
    row.appendChild(body);
    return row;
  }

  function buildCustomFieldRow(sid, field, rerender) {
    var row = document.createElement('div');
    row.className = 'admin-extra-field';

    var keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.placeholder = 'Field name';
    keyInput.value = field.label;
    keyInput.addEventListener('input', function () { field.label = keyInput.value; });

    var valInput = document.createElement('input');
    valInput.type = 'text';
    valInput.placeholder = 'Value';
    valInput.value = field.value;
    valInput.addEventListener('input', function () { field.value = valInput.value; });

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'admin-small-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', function () {
      var list = state.custom_fields[sid];
      var i = list.indexOf(field);
      if (i > -1) { list.splice(i, 1); }
      rerender();
    });

    row.appendChild(keyInput);
    row.appendChild(valInput);
    row.appendChild(removeBtn);
    return row;
  }

  function text_rows(value) {
    var len = (value || '').length;
    if (len > 160) return 4;
    if (len > 60) return 2;
    return 1;
  }

  function renderDetails() {
    detailsList.innerHTML = '';
    (state.details || []).forEach(function (detail, idx) {
      detailsList.appendChild(buildDetailCard(detail, idx));
    });
  }

  function buildDetailCard(detail, idx) {
    var card = document.createElement('div');
    card.className = 'admin-item admin-detail-card';

    var top = document.createElement('div');
    top.className = 'admin-detail-row';

    var img = document.createElement('img');
    img.className = 'admin-preview';
    img.src = detail.image || '';
    top.appendChild(img);

    var body = document.createElement('div');
    body.className = 'admin-item-body';

    var titleLabel = document.createElement('div');
    titleLabel.className = 'admin-item-label';
    titleLabel.textContent = 'Title · /details/' + detail.id;
    body.appendChild(titleLabel);

    var titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = detail.title || '';
    titleInput.addEventListener('input', function () { detail.title = titleInput.value; });
    body.appendChild(titleInput);

    var imgLabel = document.createElement('div');
    imgLabel.className = 'admin-item-label';
    imgLabel.textContent = 'Image URL';
    body.appendChild(imgLabel);

    var imgInput = document.createElement('input');
    imgInput.type = 'url';
    imgInput.value = detail.image || '';
    imgInput.addEventListener('input', function () { detail.image = imgInput.value; img.src = imgInput.value; });
    body.appendChild(imgInput);

    var descLabel = document.createElement('div');
    descLabel.className = 'admin-item-label';
    descLabel.textContent = 'Description';
    body.appendChild(descLabel);

    var descInput = document.createElement('textarea');
    descInput.rows = 3;
    descInput.value = detail.description || '';
    descInput.addEventListener('input', function () { detail.description = descInput.value; });
    body.appendChild(descInput);

    var extraLabel = document.createElement('div');
    extraLabel.className = 'admin-item-label';
    extraLabel.textContent = 'Extra information (e.g. Price, Hours, Specs...)';
    body.appendChild(extraLabel);

    var extraWrap = document.createElement('div');
    extraWrap.className = 'admin-extra-fields';
    detail.extra = detail.extra || {};

    function renderExtra() {
      extraWrap.innerHTML = '';
      Object.keys(detail.extra).forEach(function (key) {
        var row = document.createElement('div');
        row.className = 'admin-extra-field';

        var keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.placeholder = 'Field name';
        keyInput.value = key;

        var valInput = document.createElement('input');
        valInput.type = 'text';
        valInput.placeholder = 'Value';
        valInput.value = detail.extra[key];
        valInput.addEventListener('input', function () { detail.extra[key] = valInput.value; });

        keyInput.addEventListener('change', function () {
          var newKey = keyInput.value.trim();
          if (!newKey || newKey === key) return;
          var val = detail.extra[key];
          delete detail.extra[key];
          detail.extra[newKey] = val;
          renderExtra();
        });

        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'admin-small-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', function () {
          delete detail.extra[key];
          renderExtra();
        });

        row.appendChild(keyInput);
        row.appendChild(valInput);
        row.appendChild(removeBtn);
        extraWrap.appendChild(row);
      });
    }
    renderExtra();
    body.appendChild(extraWrap);

    var addFieldBtn = document.createElement('button');
    addFieldBtn.type = 'button';
    addFieldBtn.className = 'admin-small-btn';
    addFieldBtn.style.marginTop = '4px';
    addFieldBtn.textContent = '+ Add field';
    addFieldBtn.addEventListener('click', function () {
      var n = 1;
      var key = 'Field ' + n;
      while (detail.extra.hasOwnProperty(key)) { n++; key = 'Field ' + n; }
      detail.extra[key] = '';
      renderExtra();
    });
    body.appendChild(addFieldBtn);

    var removeDetailBtn = document.createElement('button');
    removeDetailBtn.type = 'button';
    removeDetailBtn.className = 'admin-small-btn';
    removeDetailBtn.style.marginTop = '10px';
    removeDetailBtn.textContent = 'Delete this detail page';
    removeDetailBtn.addEventListener('click', function () {
      state.details.splice(idx, 1);
      renderDetails();
    });
    body.appendChild(removeDetailBtn);

    top.appendChild(body);
    card.appendChild(top);
    return card;
  }

  addDetailBtn.addEventListener('click', function () {
    var n = (state.details || []).length + 1;
    var id = 'detail-custom-' + Date.now();
    state.details = state.details || [];
    state.details.push({ id: id, title: 'New item ' + n, description: '', image: '', extra: {} });
    renderDetails();
  });

  saveBtn.addEventListener('click', function () {
    saveStatus.textContent = 'Saving...';
    fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        editable: state.editable,
        details: state.details,
        custom_fields: state.custom_fields,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        saveStatus.textContent = data.success ? 'Saved.' : 'Save failed.';
        setTimeout(function () { saveStatus.textContent = ''; }, 2500);
      })
      .catch(function () { saveStatus.textContent = 'Save failed.'; });
  });

  // if a session cookie is already valid, skip straight to the dashboard
  loadContent();
})();
