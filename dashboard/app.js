// Token Radar dashboard — renders window.RADAR with no network and no fetch.
//
// Deep links use the query string, so a view can be linked and screenshotted:
//   ?view=watchlist   ?view=early   ?view=live
//   ?cat=Risk%20Curators   ?q=gauntlet   ?sort=tvl   ?detail=gauntlet
// A hash with the same keys is read as a fallback. Clicking a row opens its
// detail view; clicking a column header sorts by it.

(function () {
  'use strict';
  var R = window.RADAR;
  if (!R || !Array.isArray(R.rows)) {
    document.getElementById('rows').innerHTML = '<tr><td colspan="9">No radar data loaded.</td></tr>';
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var rowsEl = $('rows'), liveEl = $('liveRows'), detailEl = $('detail'), detailBody = $('detailBody');

  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) {
    if (n === null || n === undefined) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return '<span class="' + (n > 0 ? 'up' : n < 0 ? 'down' : '') + '">' + s + '</span>';
  }
  function ageLabel(d) {
    if (d === null || d === undefined) return '—';
    if (d < 30) return d + 'd';
    if (d < 365) return Math.round(d / 30) + 'mo';
    return (d / 365).toFixed(1) + 'y';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function factor(n) { return '×' + n.toFixed(2); }

  // ---- model panel: equation, comps, validation, scatter ----
  var fit = R.fit;
  $('formula').textContent = 'log(market cap) = ' + fit.intercept.toFixed(3) + ' + ' + fit.slope.toFixed(3) + ' × log(TVL)   —   R² = ' + fit.r_squared.toFixed(3);
  $('compCount').textContent = fit.comps;
  var vRows = '';
  vRows += '<tr><td>' + esc(R.validation.five_fold.label) + '</td><td class="num"><b>' + factor(R.validation.five_fold.factor) + '</b></td><td class="num">n=' + R.validation.five_fold.test_n + '</td></tr>';
  R.validation.time_splits.forEach(function (t) {
    vRows += '<tr><td>' + esc(t.label) + '</td><td class="num"><b>' + factor(t.factor) + '</b></td><td class="num">n=' + t.test_n + ' after cut</td></tr>';
  });
  vRows += '<tr><td>Round-1 model, same 5-fold</td><td class="num">' + factor(R.validation.round1_five_fold) + '</td><td class="num">n=93</td></tr>';
  $('validRows').innerHTML = vRows;
  $('validNote').textContent = 'Error is median |log(pred/actual)|, as a factor: ×N means the typical prediction is off by N times. R² = ' + fit.r_squared.toFixed(3) +
    ' — the curve explains ' + Math.round(fit.r_squared * 100) + '% of log-mcap variance. ' +
    'Caveat, not hidden: the 2025-07 cut (newest listings only, n=' + R.validation.caveat.test_n + ') gives ' + factor(R.validation.caveat.factor) + '. ' +
    'The curve beats round 1 by about 1.5× on blind error.';

  // ---- scatter chart: 93 comps as dots, fitted line in amber ----
  (function drawChart() {
    var pts = R.scatter || [];
    if (!pts.length) { $('chart').innerHTML = '<p class="note">No scatter data.</p>'; return; }
    var W = 640, H = 120, PL = 44, PR = 14, PT = 10, PB = 24;
    var xs = pts.map(function (p) { return p.x; });
    var ys = pts.map(function (p) { return p.y; });
    var x0 = Math.floor(Math.min.apply(null, xs)) - 0.5, x1 = Math.ceil(Math.max.apply(null, xs)) + 0.5;
    var y0 = Math.floor(Math.min.apply(null, ys)) - 0.5, y1 = Math.ceil(Math.max.apply(null, ys)) + 0.5;
    var X = function (x) { return PL + (x - x0) / (x1 - x0) * (W - PL - PR); };
    var Y = function (y) { return PT + (1 - (y - y0) / (y1 - y0)) * (H - PT - PB); };
    var s = '';
    s += '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Scatter of log TVL against log market cap for the 93 comps with the fitted line">';
    var tx;
    for (tx = Math.ceil(x0); tx <= x1; tx++) {
      s += '<line class="axis" x1="' + X(tx).toFixed(1) + '" y1="' + Y(y0).toFixed(1) + '" x2="' + X(tx).toFixed(1) + '" y2="' + Y(y1).toFixed(1) + '"/>';
      s += '<text class="tick" x="' + X(tx).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle">' + tx + '</text>';
    }
    var ty;
    for (ty = Math.ceil(y0); ty <= y1; ty++) {
      s += '<line class="axis" x1="' + X(x0).toFixed(1) + '" y1="' + Y(ty).toFixed(1) + '" x2="' + X(x1).toFixed(1) + '" y2="' + Y(ty).toFixed(1) + '"/>';
      s += '<text class="tick" x="' + (PL - 6) + '" y="' + (Y(ty) + 3).toFixed(1) + '" text-anchor="end">' + ty + '</text>';
    }
    s += '<text class="cap" x="' + (W / 2).toFixed(0) + '" y="' + (H - 4) + '" text-anchor="middle">log TVL</text>';
    s += '<text class="cap" x="10" y="' + (PT + 10) + '">log mcap</text>';
    pts.forEach(function (p) {
      s += '<circle class="dot" cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="3.5"><title>' + esc(p.slug) + '</title></circle>';
    });
    var lx0 = x0, lx1 = x1;
    s += '<line class="fit" x1="' + X(lx0).toFixed(1) + '" y1="' + Y(fit.intercept + fit.slope * lx0).toFixed(1) + '" x2="' + X(lx1).toFixed(1) + '" y2="' + Y(fit.intercept + fit.slope * lx1).toFixed(1) + '"/>';
    s += '</svg>';
    s += '<p class="note">' + fit.comps + ' comps — each dot is a live-token protocol; the amber line is the fitted curve.</p>';
    $('chart').innerHTML = s;
  })();

  // ---- header stats ----
  $('asof').textContent = R.as_of;
  $('srcDate').textContent = R.as_of;
  var top = R.rows[0];
  $('stats').innerHTML =
    '<div class="stat"><b>' + R.rows.length + '</b><span>protocols ranked</span></div>' +
    '<div class="stat"><b>' + R.watchlist_size + '</b><span>on the watchlist</span></div>' +
    '<div class="stat"><b>' + R.early_size + '</b><span>early finds below the floor</span></div>' +
    '<div class="stat"><b>' + R.live_size + '</b><span>live tokens tracked</span></div>' +
    '<div class="stat"><b>' + money(top ? top.implied_value_usd : 0) + '</b><span>top implied value' + (top ? ' — ' + esc(top.name) : '') + '</span></div>';

  // ---- category filter options ----
  var cats = {};
  R.rows.forEach(function (r) { if (r.category) cats[r.category] = true; });
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    $('cat').appendChild(o);
  });

  // ---- live table ----
  liveEl.innerHTML = R.live.map(function (p) {
    return '<tr><td><span class="name">' + esc(p.name) + '</span> <span class="slug">' + esc(p.slug) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + money(p.mcap_usd) + '</td>' +
      '<td class="num">' + (p.mcap_tvl_ratio === null ? '—' : p.mcap_tvl_ratio.toFixed(2) + '×') + '</td></tr>';
  }).join('');

  // ---- state from the query string (hash as fallback) ----
  function readState() {
    var q = {};
    try {
      var sp = new URLSearchParams(window.location.search);
      sp.forEach(function (v, k) { q[k] = v; });
    } catch (e) { /* older parser: fall through to the hash */ }
    if (!Object.keys(q).length && window.location.hash) {
      window.location.hash.slice(1).split('&').forEach(function (pair) {
        var kv = pair.split('=');
        if (kv[0]) q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
    }
    return q;
  }
  var state = readState();
  var view = state.view || 'all';
  var sortKey = state.sort || 'rank';
  var selectedSlug = state.detail || null;
  if (['all', 'watchlist', 'early', 'live'].indexOf(view) === -1) view = 'all';
  $('view').value = view;
  $('sort').value = ['rank', 'tvl', 'growth', 'age'].indexOf(sortKey) === -1 ? 'rank' : sortKey;
  sortKey = $('sort').value;
  if (state.cat) $('cat').value = state.cat;
  if (state.q) $('q').value = state.q;

  function writeState() {
    var parts = [];
    if (view !== 'all') parts.push('view=' + encodeURIComponent(view));
    if ($('cat').value) parts.push('cat=' + encodeURIComponent($('cat').value));
    if ($('q').value) parts.push('q=' + encodeURIComponent($('q').value));
    if (sortKey !== 'rank') parts.push('sort=' + encodeURIComponent(sortKey));
    if (selectedSlug) parts.push('detail=' + encodeURIComponent(selectedSlug));
    var qs = parts.join('&');
    var url = window.location.pathname + (qs ? '?' + qs : '');
    if (url !== window.location.pathname + window.location.search) history.replaceState(null, '', url);
  }

  // ---- filtering + sorting ----
  var SORTS = {
    rank: function (a, b) { return a.rank - b.rank; },
    name: function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; },
    category: function (a, b) { return (a.category || '') < (b.category || '') ? -1 : 1; },
    chains: function (a, b) { return b.chains.length - a.chains.length; },
    tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
    growth: function (a, b) { return (b.change_7d === null ? -Infinity : b.change_7d) - (a.change_7d === null ? -Infinity : a.change_7d); },
    age: function (a, b) { return (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days); },
    value: function (a, b) { return b.implied_value_usd - a.implied_value_usd; }
  };

  function visibleRows() {
    var q = $('q').value.trim().toLowerCase();
    var cat = $('cat').value;
    var list = R.rows.filter(function (r) {
      if (view === 'watchlist' && !r.watchlist) return false;
      if (view === 'early' && r.set !== 'early') return false;
      if (cat && r.category !== cat) return false;
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var sort = SORTS[sortKey] || SORTS.rank;
    return list.slice().sort(sort);
  }

  function renderBoard() {
    var list, isLive = view === 'live';
    if (isLive) {
      list = R.live.slice().sort(function (a, b) { return (b.mcap_usd || 0) - (a.mcap_usd || 0); });
      rowsEl.innerHTML = list.map(function (p) {
        return '<tr data-slug="' + esc(p.slug) + '" data-live="1">' +
          '<td><span class="badge live">LIVE</span></td>' +
          '<td><span class="name">' + esc(p.name) + '</span> <span class="slug">' + esc(p.slug) + '</span></td>' +
          '<td>' + esc(p.category || '—') + '</td>' +
          '<td class="chains">' + esc(p.chains[0] || '—') + (p.chains.length > 1 ? ' +' + (p.chains.length - 1) : '') + '</td>' +
          '<td class="num">' + money(p.tvl_usd) + '</td>' +
          '<td class="num">' + pct(p.change_7d) + '</td>' +
          '<td class="num">—</td>' +
          '<td class="num">' + money(p.mcap_usd) + '</td>' +
          '<td><span class="badge live">TRADING</span></td></tr>';
      }).join('');
      $('count').textContent = list.length + ' live-token protocols (market cap shown, not a model)';
    } else {
      list = visibleRows();
      rowsEl.innerHTML = list.map(function (r) {
        return '<tr data-slug="' + esc(r.slug) + '"' + (r.slug === selectedSlug ? ' class="selected"' : '') + '>' +
          '<td>' + r.rank + '</td>' +
          '<td><span class="name">' + esc(r.name) + '</span> <span class="slug">' + esc(r.slug) + '</span></td>' +
          '<td>' + esc(r.category || '—') + '</td>' +
          '<td class="chains">' + esc(r.chains[0] || '—') + (r.chains.length > 1 ? ' +' + (r.chains.length - 1) : '') + '</td>' +
          '<td class="num">' + money(r.tvl_usd) + '</td>' +
          '<td class="num">' + pct(r.change_7d) + '</td>' +
          '<td class="num">' + ageLabel(r.age_days) + '</td>' +
          '<td class="num">' + money(r.implied_value_usd) + '</td>' +
          '<td>' + (r.set === 'watchlist' ? '<span class="badge">WATCHLIST</span>' : '<span class="badge early">EARLY</span>') + '</td></tr>';
      }).join('');
      $('count').textContent = list.length + ' of ' + R.rows.length + ' ranked protocols shown';
    }
    document.querySelectorAll('#board thead th[data-sort]').forEach(function (th) {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === sortKey || (th.getAttribute('data-sort') === 'value' && sortKey === 'rank'));
    });
  }

  // ---- detail view ----
  function showDetail(slug) {
    selectedSlug = slug;
    var r = null, live = null;
    for (var i = 0; i < R.rows.length; i++) if (R.rows[i].slug === slug) r = R.rows[i];
    if (!r) for (var j = 0; j < R.live.length; j++) if (R.live[j].slug === slug) live = R.live[j];
    if (!r && !live) { detailEl.hidden = true; return; }
    var html;
    if (r) {
      var vClass = r.verdict === 'Farm' ? 'farm' : r.verdict === 'Watch' ? 'watch' : 'small';
      var steps = r.farm_steps.map(function (s, idx) {
        return '<li' + (idx === r.farm_steps.length - 1 ? ' class="net"' : '') + '>' + esc(s) + '</li>';
      }).join('');
      html = '<h2>#' + r.rank + ' — ' + esc(r.name) + '</h2>' +
        '<p class="meta"><span>Slug <b>' + esc(r.slug) + '</b></span><span>Category <b>' + esc(r.category || '—') + '</b></span>' +
        '<span>Chains <b>' + esc(r.chains.join(', ')) + '</b></span><span>Listed <b>' + esc(r.listed_at || 'unknown') + '</b></span>' +
        '<span>Set <b>' + (r.set === 'watchlist' ? 'Watchlist' : 'Early find') + '</b></span></p>' +
        '<p class="verdict">Verdict: <span class="badge ' + vClass + '">' + r.verdict.toUpperCase() + '</span> — Farm if implied ≥ $15M and plan gas ≤ $25; Watch if implied ≥ $5M; otherwise Small.</p>' +
        '<table class="breakdown"><thead><tr><th>Model input</th><th class="num">Value</th></tr></thead><tbody>' +
        '<tr><td>TVL</td><td class="num">' + moneyFull(r.tvl_usd) + '</td></tr>' +
        '<tr><td>Curve value — exp(' + fit.intercept.toFixed(3) + ' + ' + fit.slope.toFixed(3) + ' × ln(TVL))</td><td class="num">' + moneyFull(r.curve_value_usd) + '</td></tr>' +
        '<tr><td><b>Implied value</b></td><td class="num"><b>' + moneyFull(r.implied_value_usd) + '</b></td></tr>' +
        '<tr><td>7-day TVL change (context only — tested as a model term and dropped: its fitted sign flips by split)</td><td class="num">' + (r.change_7d === null ? 'unreported' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</td></tr>' +
        '<tr><td>Age with no token (context only — tested as a model term and dropped: it makes the blind error ×6.0)</td><td class="num">' + (r.age_days === null ? 'unknown' : r.age_days + ' days') + '</td></tr>' +
        '<tr><td>Plan gas (' + esc(r.chains[0] || 'main chain') + ', about ' + PLAN_GAS_LABEL(r) + ' per tx × 10 tx)</td><td class="num">$' + r.plan_gas_usd.toFixed(2) + '</td></tr>' +
        '<tr><td>Plan cost (gas + capital at risk)</td><td class="num">$' + r.plan_cost_usd.toFixed(2) + ' (' + (r.plan_cost_pct < 0.01 ? 'less than 0.01%' : r.plan_cost_pct.toFixed(2) + '%') + ' of implied value)</td></tr>' +
        '</tbody></table>' +
        '<h2>Farm plan — 7 steps</h2><ol class="steps">' + steps + '</ol>' +
        '<p class="note">This protocol records no token in the snapshot — that is the record, never proof it has none. The implied value is the curve&rsquo;s claim from the TVL above; the last step nets the plan&rsquo;s whole cost against it.</p>';
    } else {
      html = '<h2>' + esc(live.name) + ' <span class="badge live">ALREADY TRADING</span></h2>' +
        '<p class="meta"><span>Slug <b>' + esc(live.slug) + '</b></span><span>Category <b>' + esc(live.category || '—') + '</b></span>' +
        '<span>Chains <b>' + esc(live.chains.join(', ')) + '</b></span></p>' +
        '<table class="breakdown"><tbody>' +
        '<tr><td>TVL</td><td class="num">' + moneyFull(live.tvl_usd) + '</td></tr>' +
        '<tr><td>Market cap (the market&rsquo;s own value)</td><td class="num">' + moneyFull(live.mcap_usd) + '</td></tr>' +
        '<tr><td>Mcap / TVL</td><td class="num">' + (live.mcap_tvl_ratio === null ? '—' : live.mcap_tvl_ratio.toFixed(4) + '×') + '</td></tr>' +
        '</tbody></table>' +
        '<p class="note">Already trading, so it is not ranked on the board — it is one of the 93 comps the curve is fitted on. There is nothing to farm here for a launch.</p>';
    }
    detailBody.innerHTML = html;
    detailEl.hidden = false;
    renderBoard();
    writeState();
  }

  function PLAN_GAS_LABEL(r) {
    var g = r.gas_per_tx_usd;
    return g < 1 ? '$' + g.toFixed(2) : '$' + g;
  }

  function hideDetail() {
    selectedSlug = null;
    detailEl.hidden = true;
    renderBoard();
    writeState();
  }

  // ---- events ----
  rowsEl.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) showDetail(tr.getAttribute('data-slug'));
  });
  $('closeDetail').addEventListener('click', hideDetail);
  document.querySelectorAll('#board thead th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      sortKey = (k === 'value') ? 'rank' : (SORTS[k] ? k : 'rank');
      if (k === 'rank') sortKey = 'rank';
      $('sort').value = sortKey;
      renderBoard();
      writeState();
    });
  });
  ['q', 'cat', 'view', 'sort'].forEach(function (id) {
    $(id).addEventListener(id === 'q' ? 'input' : 'change', function () {
      view = $('view').value;
      sortKey = $('sort').value;
      renderBoard();
      writeState();
    });
  });

  renderBoard();
  // Deep links jump to what they name, after layout settles, so a linked
  // detail view or filtered board is what a screenshot (or a reader) sees.
  function jumpTo(el) {
    if (!el) return;
    setTimeout(function () {
      window.scrollTo(0, el.getBoundingClientRect().top + window.pageYOffset - 12);
    }, 60);
  }
  if (selectedSlug) {
    showDetail(selectedSlug);
    jumpTo(detailEl);
  } else if (view !== 'all') {
    jumpTo(document.querySelector('.board'));
  }
})();
