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
  var total = items.length;

  function norm(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  items.forEach(function (it) { it.norm = norm(it.text); });

  function setText(it, q) {
    var li = it.li;
    var i = q ? it.norm.indexOf(q) : -1;
    if (i < 0) { li.textContent = it.text; return; }
    li.textContent = '';
    li.appendChild(document.createTextNode(it.text.slice(0, i)));
    var m = document.createElement('mark');
    m.textContent = it.text.slice(i, i + q.length);
    li.appendChild(m);
    li.appendChild(document.createTextNode(it.text.slice(i + q.length)));
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
      if (ok) { shown++; setText(it, q); }
    });
    groups.forEach(function (g) {
      var n = g.querySelectorAll('li:not([hidden])').length;
      g.hidden = n === 0;
      g.querySelector('small').textContent = n;
    });
    count.textContent = shown + ' ' + count.dataset.of + ' ' + total + ' ' + count.dataset.unit;
    empty.hidden = shown !== 0;
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
      var s = p.toString();
      history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
    } catch (e) {}
  }

  function setOpen(open) {
    filters.hidden = !open;
    bar.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    updateBadge();
  }

  function updateBadge() {
    var active = !!(value || input.value.trim());
    badge.hidden = !value || !filters.hidden;
    clearBtn.disabled = !active;
    clearBtn.hidden = !active && filters.hidden;
  }

  function reset() { input.value = ''; value = ''; apply(); }

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
    ['year', 'hero'].forEach(function (m) {
      var v = p.get(m);
      if (v && hasChip(m, v)) { mode = m; value = v; }
    });
  } catch (e) {}
  setOpen(!!value || mode === 'year');
  apply();
})();
