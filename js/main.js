(function () {
  var input = document.getElementById('q');
  var filters = document.getElementById('filters');
  var toggle = document.getElementById('toggle');
  var badge = document.getElementById('badge');
  var bar = input.closest('.bar');
  var boxes = { year: document.getElementById('chips-year'), hero: document.getElementById('chips-hero') };
  var count = document.getElementById('count');
  var clearBtn = document.getElementById('clear');
  var empty = document.getElementById('empty');
  var sheet = document.getElementById('sheet');
  var views = document.getElementById('views');
  var download = document.getElementById('download');
  var groups = [].slice.call(document.querySelectorAll('section.year'));
  var items = [].slice.call(document.querySelectorAll('.movies li')).map(function (li) {
    return {
      li: li,
      text: li.textContent.trim(),
      year: li.closest('section').dataset.year,
      heroes: li.dataset.heroes.split(' ')
    };
  });
  var mode = 'hero';
  var value = '';
  var view = 'cards';
  var total = items.length;

  function norm(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  var tagNames = {};
  [].forEach.call(boxes.hero.children, function (c) { tagNames[c.dataset.value] = c.textContent; });

  items.forEach(function (it) {
    it.norm = norm(it.text);
    it.row = sheet.tBodies[0].insertRow();
    it.row.insertCell().textContent = it.year;
    it.cell = it.row.insertCell();
    var tags = it.row.insertCell();
    it.heroes.forEach(function (h) {
      var tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = tagNames[h];
      tags.appendChild(tag);
    });
  });

  function setText(el, it, q) {
    var i = q ? it.norm.indexOf(q) : -1;
    if (i < 0) { el.textContent = it.text; return; }
    el.textContent = '';
    el.appendChild(document.createTextNode(it.text.slice(0, i)));
    var m = document.createElement('mark');
    m.textContent = it.text.slice(i, i + q.length);
    el.appendChild(m);
    el.appendChild(document.createTextNode(it.text.slice(i + q.length)));
  }

  function matches(it) {
    if (!value) return true;
    return mode === 'year' ? it.year === value : it.heroes.indexOf(value) > -1;
  }

  function apply() {
    var q = norm(input.value.trim());
    var shown = 0;
    items.forEach(function (it) {
      var ok = matches(it) && (!q || it.norm.indexOf(q) > -1);
      it.li.hidden = !ok;
      it.row.hidden = !ok;
      if (ok) { shown++; setText(it.li, it, q); setText(it.cell, it, q); }
    });
    groups.forEach(function (g) {
      var n = g.querySelectorAll('li:not([hidden])').length;
      g.hidden = n === 0 || view === 'list';
      g.querySelector('small').textContent = n;
    });
    count.textContent = shown + ' ' + count.dataset.of + ' ' + total + ' ' + count.dataset.unit;
    empty.hidden = shown !== 0;
    sheet.hidden = shown === 0 || view !== 'list';
    download.disabled = shown === 0;
    [].forEach.call(views.children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.view === view));
    });
    updateBadge();
    [].forEach.call(filters.querySelectorAll('[data-mode]'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    });
    Object.keys(boxes).forEach(function (m) {
      boxes[m].hidden = m !== mode;
      [].forEach.call(boxes[m].children, function (c) {
        c.setAttribute('aria-pressed', String(m === mode && c.dataset.value === value));
      });
    });
    try {
      var p = new URLSearchParams();
      if (input.value.trim()) p.set('q', input.value.trim());
      if (value) p.set(mode, value);
      else if (mode !== 'hero') p.set('by', mode);
      if (view !== 'cards') p.set('view', view);
      var s = p.toString();
      history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
    } catch (e) {}
    syncBar();
  }

  // The table header sticks just under the search bar, whose height changes
  function syncBar() {
    var h = getComputedStyle(bar).position === 'sticky' ? bar.offsetHeight : 0;
    document.documentElement.style.setProperty('--bar-h', h + 'px');
  }

  function setOpen(open) {
    filters.hidden = !open;
    bar.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    updateBadge();
    syncBar();
  }

  function updateBadge() {
    var active = !!(value || input.value.trim());
    badge.hidden = !value || !filters.hidden;
    clearBtn.disabled = !active;
    clearBtn.hidden = !active && filters.hidden;
  }

  function reset() { input.value = ''; value = ''; apply(); }

  // Excel opens this correctly thanks to the BOM and the page's separator (pt-BR Excel expects ';')
  function downloadCsv() {
    var head = [].map.call(sheet.tHead.rows[0].cells, function (th) { return th.textContent; });
    var rows = items.filter(function (it) { return !it.row.hidden; }).map(function (it) {
      return [it.year, it.text, it.heroes.map(function (h) { return tagNames[h]; }).join(', ')];
    });
    var text = [head].concat(rows).map(function (cols) {
      return cols.map(function (c) { return '"' + c.replace(/"/g, '""') + '"'; }).join(download.dataset.sep);
    }).join('\r\n') + '\r\n';
    var url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = download.dataset.file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  input.addEventListener('input', apply);
  toggle.addEventListener('click', function () { setOpen(filters.hidden); });
  filters.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mode) {
      if (b.dataset.mode !== mode) { mode = b.dataset.mode; value = ''; }
    } else {
      value = b.dataset.value === value ? '' : b.dataset.value;
    }
    apply();
  });
  clearBtn.addEventListener('click', reset);
  download.addEventListener('click', downloadCsv);
  views.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    view = b.dataset.view;
    apply();
  });
  window.addEventListener('resize', syncBar);
  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) { e.preventDefault(); input.focus(); input.select(); }
    else if (e.key === 'Escape' && document.activeElement === input) { input.value ? (input.value = '', apply()) : input.blur(); }
  });

  function hasChip(m, v) {
    return [].some.call(boxes[m].children, function (c) { return c.dataset.value === v; });
  }

  try {
    var p = new URLSearchParams(location.search);
    input.value = p.get('q') || '';
    if (p.get('by') === 'year') mode = 'year';
    if (p.get('view') === 'list') view = 'list';
    ['year', 'hero'].forEach(function (m) {
      var v = p.get(m);
      if (v && hasChip(m, v)) { mode = m; value = v; }
    });
  } catch (e) {}
  setOpen(!!value || mode === 'year');
  apply();
})();
