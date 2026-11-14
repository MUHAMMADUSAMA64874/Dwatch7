/* ==========================================================================
   WRISTLAB, application shell
   Hash router, watch bridge, arcade, protocol lab, decode story, manager
   Dependency-free. Reads window.WRIST_GAMES from games/registry.js.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Small helpers                                                      */
  /* ------------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const pad2 = n => String(n).padStart(2, '0');

  /* ------------------------------------------------------------------ */
  /*  Icons, Font Awesome 5 Free via CDN (SVG with JS).                 */
  /*  The library replaces each <i> with an inline SVG; no emoji and no  */
  /*  hand-drawn paths.                                                   */
  /* ------------------------------------------------------------------ */
  const ICONS = {
    dot: 'fas fa-circle',
    dashboard: 'fas fa-th-large',
    arcade: 'fas fa-gamepad',
    lab: 'fas fa-flask',
    story: 'fas fa-book-open',
    manage: 'fas fa-sliders-h',
    heart: 'fas fa-heart',
    wave: 'fas fa-wave-square',
    gauge: 'fas fa-tachometer-alt',
    clock: 'fas fa-clock',
    bell: 'fas fa-bell',
    star: 'far fa-star',
    starFill: 'fas fa-star',
    play: 'fas fa-play',
    diamond: 'fas fa-gem',
    download: 'fas fa-download',
    droplet: 'fas fa-tint',
    watch: 'fas fa-clock',
    shake: 'fas fa-wave-square',
    file: 'far fa-file-alt',
    server: 'fas fa-server',
    archive: 'fas fa-archive',
    compass: 'fas fa-compass',
    signal: 'fas fa-broadcast-tower',
    help: 'far fa-question-circle',
    cpu: 'fas fa-microchip',
    link: 'fas fa-link',
    search: 'fas fa-search',
  };

  const GAME_ICONS = {
    'neon-serpent': 'fas fa-dragon',
    'pulse-pong': 'fas fa-table-tennis',
    'brick-storm': 'fas fa-th',
    'star-drifter': 'fas fa-rocket',
    'wrist-runner': 'fas fa-running',
    'hex-memory': 'fas fa-brain',
    'tilt-labyrinth': 'fas fa-route',
    'meteor-rush': 'fas fa-meteor',
    'wrist-hop': 'fas fa-dove',
    'rhythm-grid': 'fas fa-music',
    'mole-mayhem': 'fas fa-hammer',
    'grid-2048': 'fas fa-border-all',
    'tank-duel': 'fas fa-crosshairs',
    'laser-grid': 'fas fa-bolt',
    'fruit-frenzy': 'fas fa-apple-alt',
    'tower-stack': 'fas fa-layer-group',
    'reflex-duel': 'fas fa-stopwatch',
    'circuit-breaker': 'fas fa-plug',
    'orbit-sling': 'fas fa-globe',
    'dungeon-dash': 'fas fa-dungeon',
  };

  function iconEl(classes, cls) {
    return '<i class="' + classes + ' ' + (cls || 'ico-svg') + '" aria-hidden="true"></i>';
  }
  function icon(name, cls) {
    return iconEl(ICONS[name] || ICONS.dot, cls);
  }
  function gameIcon(id, cls) {
    return iconEl(GAME_ICONS[id] || ICONS.arcade, cls);
  }

  const GAMES = Array.isArray(window.WRIST_GAMES) ? window.WRIST_GAMES.slice() : [];
  const CATS = Array.isArray(window.WRIST_CATEGORIES) ? window.WRIST_CATEGORIES : ['All'];
  const BY_ID = new Map(GAMES.map(g => [g.id, g]));

  const LS = {
    get(k, d) {
      try { const v = localStorage.getItem('wristlab_ui_' + k); return v === null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem('wristlab_ui_' + k, JSON.stringify(v)); } catch (e) {}
    },
    rawGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  };

  const settings = Object.assign({
    sound: true, motion: true, autoconnect: true,
  }, LS.get('settings', {}));
  const state = {
    route: 'dashboard',
    arcade: { cat: 'All', q: '' },
    history: LS.get('history', []).filter(id => BY_ID.has(id)),
    plays: LS.get('plays', {}) || {},
    favorites: LS.get('favorites', []).filter(id => BY_ID.has(id)),
  };

  function saveSettings() { LS.set('settings', settings); }
  function saveState() {
    LS.set('history', state.history.slice(0, 24));
    LS.set('plays', state.plays);
    LS.set('favorites', state.favorites);
  }

  function bestOf(id) {
    const raw = LS.rawGet('wristlab_' + id + '_best');
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  function totalBest() { return GAMES.reduce((n, g) => n + bestOf(g.id), 0); }
  function bestCount() { return GAMES.filter(g => bestOf(g.id) > 0).length; }
  function playCount() { return Object.values(state.plays).reduce((n, v) => n + (Number(v) || 0), 0); }
  function lastPlayed() {
    return state.history.map(id => BY_ID.get(id)).filter(Boolean).slice(0, 5);
  }

  function ago(ts) {
    if (!ts) return '';
    const d = Date.now() - ts;
    if (d < 6e4) return 'just now';
    if (d < 36e5) return Math.floor(d / 6e4) + 'm ago';
    if (d < 864e5) return Math.floor(d / 36e5) + 'h ago';
    return Math.floor(d / 864e5) + 'd ago';
  }

  const DIFF = ['', 'Easy', 'Medium', 'Hard'];
  function diffLabel(n) { return DIFF[clamp(n || 1, 1, 3)]; }
  function diffDots(n) {
    n = clamp(n || 1, 1, 3);
    return '<span class="diff-dots" aria-label="Difficulty ' + diffLabel(n) + '">' +
      [1, 2, 3].map(i => '<i class="' + (i <= n ? 'on' : '') + '"></i>').join('') + '</span>';
  }

  /* ------------------------------------------------------------------ */
  /*  UI sound                                                           */
  /* ------------------------------------------------------------------ */
  let audioCtx = null;
  function uiSound(kind) {
    if (!settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t = audioCtx.currentTime + 0.005;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      const freq = kind === 'open' ? 520 : kind === 'close' ? 340 : kind === 'error' ? 180 : 660;
      o.type = kind === 'error' ? 'sawtooth' : 'triangle';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * (kind === 'close' ? .72 : 1.24), t + .07);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(kind === 'error' ? .045 : .035, t + .008);
      g.gain.exponentialRampToValueAtTime(.0001, t + .09);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t); o.stop(t + .1);
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ */
  /*  Toasts                                                             */
  /* ------------------------------------------------------------------ */
  function toast(title, msg, kind) {
    const wrap = $('#toasts');
    if (!wrap) return;
    const node = document.createElement('div');
    node.className = 'toast ' + (kind || '');
    node.innerHTML = '<span class="bar"></span><div><b>' + esc(title) + '</b>' +
      (msg ? '<span>' + esc(msg) + '</span>' : '') + '</div>';
    wrap.appendChild(node);
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 260);
    }, 4200);
  }

  /* ------------------------------------------------------------------ */
  /*  Watch bridge (dashboard_server.py WebSocket)                       */
  /* ------------------------------------------------------------------ */
  const bridge = {
    ws: null, status: 'offline', timer: null, backoff: 1500, firstTry: true,
    data: { connected: false, battery: null, hr: null, spo2: null, bp: null, profile: 'dodge', stats: {} },
    hrHist: [],
  };

  function bridgeUrl() {
    const q = new URLSearchParams(location.search).get('ws');
    if (q) return q;
    const host = location.hostname || '127.0.0.1';
    return 'ws://' + host + ':8780';
  }

  function send(obj) {
    if (bridge.ws && bridge.ws.readyState === 1) {
      try { bridge.ws.send(JSON.stringify(obj)); return true; } catch (e) {}
    }
    return false;
  }

  function needsBridge() {
    if (bridge.status === 'online') return false;
    toast('Bridge is offline', 'Start start.bat, then keep this tab open.', 'warn');
    return true;
  }

  function connectBridge(manual) {
    if (!settings.autoconnect && !manual) return;
    if (bridge.ws && bridge.ws.readyState < 2) return;
    clearTimeout(bridge.timer);
    bridge.status = bridge.firstTry ? 'linking' : 'retrying';
    paintBridge();
    let ws;
    try { ws = new WebSocket(bridgeUrl()); } catch (e) { scheduleBridge(); return; }
    bridge.ws = ws;
    const thisSocket = ws;

    ws.onopen = () => {
      if (bridge.ws !== thisSocket) return;
      bridge.status = 'online';
      bridge.firstTry = false;
      bridge.backoff = 1500;
      if (!document.hidden) {
        // quiet on first paint, loud on a recovered link
        if (bridge.everFailed) toast('Watch bridge linked', 'Wrist controls are live.', 'ok');
      }
      bridge.everFailed = false;
      send({ type: 'set_profile', profile: 'dodge', keyboard_emulation: false });
      send({ type: 'set_button_action', action: 'game' });
      paintBridge();
    };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m && typeof m === 'object') handleBridge(m);
    };
    ws.onclose = () => {
      if (bridge.ws !== thisSocket) return;
      bridge.status = 'offline';
      bridge.everFailed = true;
      bridge.data.connected = false;
      paintBridge();
      scheduleBridge();
    };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  }

  function scheduleBridge() {
    if (!settings.autoconnect) return;
    if (bridge.timer) return;
    const delay = bridge.backoff;
    bridge.backoff = Math.min(15000, Math.round(bridge.backoff * 1.6));
    bridge.timer = setTimeout(() => { bridge.timer = null; connectBridge(); }, delay);
  }

  function disconnectBridge() {
    settings.autoconnect = false; saveSettings();
    clearTimeout(bridge.timer); bridge.timer = null;
    if (bridge.ws) { try { bridge.ws.close(); } catch (e) {} }
    bridge.ws = null; bridge.status = 'offline'; bridge.data.connected = false;
    paintBridge();
  }

  function handleBridge(m) {
    if (m.type === 'status') {
      bridge.data.connected = !!m.connected;
      if (m.battery != null) bridge.data.battery = m.battery;
      if (m.heartrate) bridge.data.hr = m.heartrate;
      if (m.spo2) bridge.data.spo2 = m.spo2;
      if (Array.isArray(m.bp) && m.bp[0]) bridge.data.bp = m.bp;
      if (m.profile) bridge.data.profile = m.profile;
      if (m.stats) bridge.data.stats = m.stats;
      bridge.status = 'online';
    } else if (m.type === 'battery') {
      bridge.data.battery = m.level;
      logLine('sys', 'Battery ' + m.level + '%');
    } else if (m.type === 'heartrate') {
      if (m.bpm) { bridge.data.hr = m.bpm; pushHr(m.bpm); }
      if (m.spo2) bridge.data.spo2 = m.spo2;
      if (m.bp_high) bridge.data.bp = [m.bp_high, m.bp_low];
      logLine('rx', 'Health, BPM ' + (m.bpm || '--') + ', SpO2 ' + (m.spo2 || '--') +
        '%, BP ' + (m.bp_high ? m.bp_high + '/' + m.bp_low : '--'));
    } else if (m.type === 'sensor_state') {
      const label = (m.sensor || 'sensor').toUpperCase();
      if (m.measuring) logLine('sys', label + ' measuring, ' + (m.duration_sec || 20) + 's');
      else logLine('rx', label + ' reading complete');
      if (m.measuring) toast(label + ' measuring', 'Hold still while the optical sensor runs.', 'info');
    } else if (m.type === 'button') {
      logLine('rx', 'Button, ' + (m.button || '?') + ', ' + (m.source || 'watch'));
      $$('[data-live="lastButton"]').forEach(n => { n.textContent = m.button || '?'; });
    } else if (m.type === 'notification_sent') {
      logLine('tx', 'Notification sent, ' + (m.title || '') + ' ' + (m.content || ''));
    } else if (m.type === 'dial_applied') {
      logLine('tx', 'Dial applied, ' + (m.code || ''));
    } else if (m.type === 'profile_changed') {
      bridge.data.profile = m.profile || bridge.data.profile;
      logLine('sys', 'Keyboard profile, ' + (m.profile || 'none'));
    } else if (m.type === 'button_action_changed') {
      logLine('sys', 'Watch button action, ' + (m.action || 'game'));
    } else if (m.type === 'raw_rx') {
      logLine('rx', (m.hex || '').toUpperCase());
    } else if (m.type === 'raw_tx') {
      logLine('tx', (m.hex || '').toUpperCase());
    } else if (m.type === 'time_synced') {
      logLine('tx', 'Time sync applied, ' + (m.time || ''));
      toast('Watch time synced', m.time || '', 'ok');
    } else if (m.type === 'error') {
      logLine('err', m.message || 'Bridge error');
      toast('Bridge error', m.message || 'The watch rejected that command.', 'err');
    }
    paintBridge();
  }

  function pushHr(bpm) {
    bridge.hrHist.push(bpm);
    if (bridge.hrHist.length > 48) bridge.hrHist.shift();
  }

  function paintBridge() {
    const online = bridge.status === 'online';
    const bleOn = online && bridge.data.connected;
    const battery = bridge.data.battery;

    ['#watchChip', '#sideBridge'].forEach(sel => {
      const node = $(sel);
      if (node) node.classList.toggle('online', online);
    });

    const chipText = $('#watchChipText');
    if (chipText) chipText.textContent = online ? (bleOn ? 'Watch linked' : 'Bridge up') : (bridge.status === 'linking' ? 'Linking...' : 'Bridge offline');
    const bat = $('#batteryChip');
    if (bat) bat.textContent = battery == null ? '--%' : battery + '%';

    const sideText = $('#sideBridgeText');
    if (sideText) sideText.textContent = online ? (bleOn ? 'Watch online' : 'Bridge online') : (bridge.status === 'linking' ? 'Linking bridge...' : 'Bridge offline');
    const sideHint = $('#sideBridgeHint');
    if (sideHint) sideHint.innerHTML = online
      ? (bleOn ? 'BLE link live, buttons ready' : 'Waiting for the watch')
      : 'Start <b>start.bat</b> to link the watch.';

    const dotOn = online && bleOn;
    const hb = $('#heroBeat');
    if (hb) hb.style.opacity = dotOn ? '1' : '.35';

    $$('[data-bridge-banner]').forEach(n => { n.style.display = online ? 'none' : 'flex'; });

    $$('[data-live="status"]').forEach(n => {
      n.textContent = online ? (bleOn ? 'Watch online' : 'Bridge online') : 'Offline';
      n.className = n.className.replace(/\b(ok|warn|dead)\b/g, '').trim() + ' ' + (bleOn ? 'ok' : online ? 'warn' : 'dead');
    });
    $$('[data-live="battery"]').forEach(n => { n.textContent = battery == null ? '--' : battery + '%'; });
    $$('[data-live="hr"]').forEach(n => { n.textContent = bridge.data.hr == null ? '--' : bridge.data.hr; });
    $$('[data-live="spo2"]').forEach(n => { n.textContent = bridge.data.spo2 == null ? '--' : bridge.data.spo2; });
    $$('[data-live="bp"]').forEach(n => {
      n.textContent = bridge.data.bp ? bridge.data.bp[0] + '/' + bridge.data.bp[1] : '--/--';
    });
    $$('[data-live="batteryBar"]').forEach(n => {
      n.style.transform = 'scaleX(' + (battery == null ? 0 : clamp(battery, 0, 100) / 100) + ')';
    });
    $$('[data-live="profile"]').forEach(n => { n.textContent = bridge.data.profile || 'none'; });
    $$('[data-live="presses"]').forEach(n => { n.textContent = (bridge.data.stats && bridge.data.stats.presses) || 0; });
    drawSpark();
    paintSensors();
  }

  function paintSensors() {
    $$('[data-sensor="hr"]').forEach(n => n.classList.toggle('active', bridge.data.hr != null));
    $$('[data-sensor="spo2"]').forEach(n => n.classList.toggle('active', bridge.data.spo2 != null));
    $$('[data-sensor="bp"]').forEach(n => n.classList.toggle('active', !!bridge.data.bp));
  }

  function drawSpark() {
    const svg = $('#hrSpark');
    if (!svg) return;
    const data = bridge.hrHist.slice();
    const w = 300, h = 58, n = data.length;
    const line = svg.querySelector('polyline');
    const area = svg.querySelector('polygon');
    const empty = $('#sparkEmpty');
    if (empty) empty.hidden = n > 0;
    if (!n) {
      if (line) line.setAttribute('points', '');
      if (area) area.setAttribute('points', '');
      return;
    }
    const min = Math.min.apply(null, data) - 5;
    const max = Math.max.apply(null, data) + 5;
    const pts = data.map((v, i) => {
      const x = n <= 1 ? w / 2 : (i / (n - 1)) * w;
      const y = h - ((v - min) / Math.max(1, max - min)) * (h - 8) - 4;
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    if (line) line.setAttribute('points', pts.join(' '));
    if (area) area.setAttribute('points', '0,' + h + ' ' + pts.join(' ') + ' ' + w + ',' + h);
  }

  /* ------------------------------------------------------------------ */
  /*  Lab event log                                                      */
  /* ------------------------------------------------------------------ */
  const labLog = [];
  function logLine(kind, msg) {
    const d = new Date();
    labLog.push({ t: pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()), kind, msg });
    if (labLog.length > 240) labLog.shift();
    const box = $('#labLog');
    if (box) {
      box.insertAdjacentHTML('beforeend', logRow(labLog[labLog.length - 1]));
      while (box.children.length > 240) box.firstElementChild.remove();
      box.scrollTop = box.scrollHeight;
    }
  }
  function logRow(r) {
    return '<div class="row"><span class="t">' + esc(r.t) + '</span><span class="tag ' + esc(r.kind) + '">' +
      esc(r.kind) + '</span><span class="msg">' + esc(r.msg) + '</span></div>';
  }

  /* ------------------------------------------------------------------ */
  /*  Routing                                                            */
  /* ------------------------------------------------------------------ */
  const ROUTES = {
    dashboard: { label: 'Dashboard', render: viewDashboard },
    arcade: { label: 'Arcade', render: viewArcade },
    lab: { label: 'Protocol Lab', render: viewLab },
    story: { label: 'The Decode', render: viewStory },
    manage: { label: 'Manage', render: viewManage },
  };

  function currentRoute() {
    const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES[raw] ? raw : 'dashboard';
  }

  function navigate(route) {
    if (!ROUTES[route]) route = 'dashboard';
    if (location.hash === '#/' + route) { renderRoute(); return; }
    location.hash = '#/' + route;
  }

  function renderRoute() {
    closeGame();
    const route = currentRoute();
    state.route = route;
    const view = $('#view');
    if (!view) return;
    document.body.dataset.route = route;
    view.className = 'view' + (route === 'story' ? ' narrow' : '');
    view.innerHTML = ROUTES[route].render();
    document.title = ROUTES[route].label + ', WristLab';
    const crumb = $('#crumb');
    if (crumb) crumb.textContent = ROUTES[route].label;
    $$('#nav a').forEach(a => a.classList.toggle('active', a.getAttribute('data-nav') === route));
    window.scrollTo({ top: 0, behavior: settings.motion ? 'smooth' : 'auto' });
    uiSound('open');
    requestAnimationFrame(() => {
      view.classList.add('rise');
      afterRender(route);
    });
  }

  function afterRender(route) {
    paintBridge();
    if (route === 'dashboard') afterDashboard();
    if (route === 'arcade') afterArcade();
    if (route === 'lab') afterLab();
    if (route === 'story') afterStory();
    if (route === 'manage') afterManage();
    updateClock();
  }

  /* ------------------------------------------------------------------ */
  /*  Shared view pieces                                                 */
  /* ------------------------------------------------------------------ */
  function pageHead(title, lead, right) {
    return '<div class="page-head rise">' +
      '<div class="ph-row"><h1>' + title + '</h1>' + (right || '') + '</div>' +
      (lead ? '<p class="lead">' + lead + '</p>' : '') +
      '</div>';
  }

  function foot() {
    return '<footer class="foot"><span>WristLab, D Watch 7 reverse-engineered studio</span>' +
      '<span>20 games, protocol lab, <a href="#/story">the full story</a></span></footer>';
  }

  function gameCard(g, index, opts) {
    opts = opts || {};
    const best = bestOf(g.id);
    const fav = state.favorites.includes(g.id);
    const num = String(index + 1).padStart(2, '0');
    const tags = (g.tags || []).slice(0, 3).map(t => '<span class="gtag">' + esc(t) + '</span>').join('');
    return '<article class="game-card' + (opts.mini ? ' mini' : '') + '" style="--ta:' + esc(g.accent) + ';--tb:' + esc(g.accent2) + '">' +
      '<a class="card-link" href="' + esc(g.file) + '" data-game="' + esc(g.id) + '" aria-label="Play ' + esc(g.title) + '"></a>' +
      '<div class="thumb">' +
        '<span class="thumb-num">' + num + '</span>' +
        '<div class="thumb-badges">' +
          (g.featured ? '<span class="tbadge hot">Featured</span>' : '') +
          (best ? '<span class="tbadge">Best ' + best + '</span>' : '') +
        '</div>' +
        '<div class="thumb-icon" aria-hidden="true">' + gameIcon(g.id) + '</div>' +
        '<span class="thumb-play">' + icon('play') + ' Play</span>' +
      '</div>' +
      '<div class="game-body">' +
        '<div class="game-title-row"><span class="game-title">' + esc(g.title) + '</span>' +
          '<button class="fav-btn' + (fav ? ' on' : '') + '" data-fav="' + esc(g.id) + '" title="' + (fav ? 'Remove from favourites' : 'Add to favourites') + '" aria-label="Toggle favourite">' + icon(fav ? 'starFill' : 'star') + '</button>' +
        '</div>' +
        '<p class="game-tagline">' + esc(g.tagline) + '</p>' +
        '<div class="game-tags">' + tags + '</div>' +
        '<div class="game-foot">' +
          '<span class="game-controls">' + diffDots(g.difficulty) + ' ' + esc(diffLabel(g.difficulty)) + '</span>' +
          '<span class="game-play">' + esc(g.category) + '</span>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function featuredBlock(g) {
    return '<div class="featured rise">' +
      '<div class="featured-copy">' +
        '<span class="featured-badge">' + icon('diamond') + ' Featured run, ' + esc(g.category || 'Arcade') + '</span>' +
        '<h2>' + esc(g.title) + '</h2>' +
        '<p>' + esc(g.desc) + '</p>' +
        '<div class="meta"><span class="badge ok">' + esc(diffLabel(g.difficulty)) + '</span>' +
          (g.tags || []).slice(0, 3).map(t => '<span class="badge">' + esc(t) + '</span>').join('') +
          (bestOf(g.id) ? '<span class="badge info">Best ' + bestOf(g.id) + '</span>' : '') + '</div>' +
        '<div class="hero-cta"><button class="btn btn-primary" data-game="' + esc(g.id) + '">' + icon('play') + ' Play now</button>' +
          '<a class="btn btn-secondary" href="#/arcade">All 20 games</a></div>' +
      '</div>' +
      '<div class="featured-art"><div class="featured-icon">' + gameIcon(g.id) + '</div></div>' +
    '</div>';
  }

  function hrSparkSVG() {
    return '<div class="spark-wrap"><svg class="spark" id="hrSpark" viewBox="0 0 300 58" preserveAspectRatio="none" aria-label="Heart rate history">' +
      '<defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" style="stop-color:var(--color-cool);stop-opacity:.18"/>' +
        '<stop offset="1" style="stop-color:var(--color-cool);stop-opacity:0"/></linearGradient></defs>' +
      '<polygon fill="url(#sparkFill)" points=""></polygon>' +
      '<polyline fill="none" style="stroke:var(--color-cool)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" points=""></polyline>' +
      '</svg><div class="spark-empty" id="sparkEmpty">No readings yet. Request a heart-rate read to start the trace.</div></div>' +
      '<div class="spark-meta"><span>Heart-rate history</span><span>From the optical sensor, when connected</span></div>';
  }

  /* ------------------------------------------------------------------ */
  /*  Game modal                                                         */
  /* ------------------------------------------------------------------ */
  let gameTimer = null;

  function openGame(id) {
    const g = BY_ID.get(id);
    if (!g) return;
    const modal = $('#gameModal');
    if (!modal) return;
    // track
    state.history = [id].concat(state.history.filter(x => x !== id)).slice(0, 24);
    state.plays[id] = (state.plays[id] || 0) + 1;
    saveState();
    $('#gmIcon').innerHTML = gameIcon(g.id);
    $('#gmTitle').textContent = g.title;
    $('#gmSub').textContent = (g.category || 'Arcade') + ', ' + diffLabel(g.difficulty) + ', best ' + bestOf(id);
    const frame = $('#gmFrame');
    frame.src = g.file + '?embed=1';
    $('#gmOpenTab').onclick = () => window.open(g.file, '_blank', 'noopener');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    uiSound('open');
    gameTimer = setInterval(() => {
      const sub = $('#gmSub');
      const b = bestOf(id);
      if (sub) sub.textContent = (g.category || 'Arcade') + ', ' + diffLabel(g.difficulty) + ', best ' + b;
    }, 1400);
  }

  function closeGame() {
    const modal = $('#gameModal');
    if (!modal) return;
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    const frame = $('#gmFrame');
    if (frame) { frame.src = 'about:blank'; }
    document.body.classList.remove('no-scroll');
    clearInterval(gameTimer); gameTimer = null;
    if (state.route === 'arcade') refreshArcadeGrid();
  }

  /* ------------------------------------------------------------------ */
  /*  Command palette                                                    */
  /* ------------------------------------------------------------------ */
  let paletteIndex = 0;
  let paletteItems = [];

  function paletteActions() {
    const acts = [
      { icon: icon('dashboard'), label: 'Go to dashboard', hint: 'Page', run: () => navigate('dashboard') },
      { icon: icon('arcade'), label: 'Go to arcade', hint: 'Page', run: () => navigate('arcade') },
      { icon: icon('lab'), label: 'Go to protocol lab', hint: 'Page', run: () => navigate('lab') },
      { icon: icon('story'), label: 'Read the decode', hint: 'Page', run: () => navigate('story') },
      { icon: icon('manage'), label: 'Open manage', hint: 'Page', run: () => navigate('manage') },
      { icon: icon('heart'), label: 'Measure heart rate', hint: 'Sensor', run: () => requestHr() },
      { icon: icon('clock'), label: 'Sync watch time', hint: 'Watch', run: () => syncTime() },
      { icon: icon('bell'), label: 'Send test notification', hint: 'Watch', run: () => sendNotification('WristLab', 'Command palette', 'Hello from the studio.') },
    ];
    GAMES.forEach(g => acts.push({
      icon: gameIcon(g.id), label: 'Play ' + g.title, hint: g.category || 'Game',
      run: () => openGame(g.id),
    }));
    return acts;
  }

  function openPalette() {
    const pal = $('#palette');
    if (!pal) return;
    pal.classList.add('open');
    pal.setAttribute('aria-hidden', 'false');
    const input = $('#paletteInput');
    input.value = '';
    paletteIndex = 0;
    renderPalette('');
    setTimeout(() => input.focus(), 20);
  }
  function closePalette() {
    const pal = $('#palette');
    if (!pal) return;
    pal.classList.remove('open');
    pal.setAttribute('aria-hidden', 'true');
  }
  function renderPalette(q) {
    q = (q || '').toLowerCase().trim();
    const all = paletteActions();
    paletteItems = all.filter(a => !q || a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q)).slice(0, 40);
    if (paletteIndex >= paletteItems.length) paletteIndex = 0;
    const list = $('#paletteList');
    if (!list) return;
    if (!paletteItems.length) {
      list.innerHTML = '<div class="pempty">Nothing matches. Try “game” or “sensor”.</div>';
      return;
    }
    list.innerHTML = paletteItems.map((a, i) =>
      '<div class="pitem' + (i === paletteIndex ? ' sel' : '') + '" data-pi="' + i + '"><span class="pi2">' + a.icon + '</span>' +
      esc(a.label) + '<small>' + esc(a.hint) + '</small></div>').join('');
  }
  function runPalette(i) {
    const a = paletteItems[i];
    if (!a) return;
    closePalette();
    setTimeout(a.run, 30);
  }

  /* ------------------------------------------------------------------ */
  /*  Watch / sensor actions                                             */
  /* ------------------------------------------------------------------ */
  function requestHr() {
    if (send({ type: 'hr_request' })) {
      toast('Heart rate requested', 'The optical sensor runs for about 20 seconds.', 'info');
      logLine('tx', 'HR trigger, cmd 0x06 key 0x04');
    } else needsBridge();
  }
  function requestBp() {
    if (send({ type: 'bp_request' })) {
      toast('Blood pressure requested', 'Hold still, this takes about 25 seconds.', 'info');
      logLine('tx', 'BP trigger, cmd 0x06 key 0x05');
    } else needsBridge();
  }
  function syncTime() {
    if (send({ type: 'sync_time' })) {
      toast('Time sync sent', 'Packed local time written to the watch.', 'ok');
      logLine('tx', 'Time sync, cmd 0x02 key 0x08');
    } else needsBridge();
  }
  function sendNotification(app, title, content) {
    if (send({ type: 'notification', app: app, title: title, content: content })) {
      toast('Notification pushed', title + ', ' + content, 'ok');
      logLine('tx', 'Notification, ' + app + ', ' + title);
    } else needsBridge();
  }

  /* ------------------------------------------------------------------ */
  /*  Clock                                                              */
  /* ------------------------------------------------------------------ */
  let clockTimer = null;
  function updateClock() {
    const now = new Date();
    const hh = now.getHours(), mm = now.getMinutes(), ss = now.getSeconds();
    const timeEl = $('#watchTime');
    if (timeEl) timeEl.textContent = pad2(hh) + ':' + pad2(mm) + ':' + pad2(ss);
    const dateEl = $('#watchDate');
    if (dateEl) dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
    const sec = now.getSeconds() + now.getMilliseconds() / 1000;
    const min = mm + sec / 60;
    const hour = (hh % 12) + min / 60;
    const rot = (id, deg) => { const n = document.getElementById(id); if (n) n.setAttribute('transform', 'rotate(' + deg + ' 160 200)'); };
    rot('handS', sec * 6);
    rot('handM', min * 6);
    rot('handH', hour * 30);
    const big = $('#liveClock');
    if (big) big.textContent = pad2(hh) + ':' + pad2(mm) + ':' + pad2(ss);
  }
  function startClock() {
    if (clockTimer) return;
    updateClock();
    clockTimer = setInterval(() => {
      updateClock();
    }, 1000);
  }

  /* ------------------------------------------------------------------ */
  /*  Global events                                                      */
  /* ------------------------------------------------------------------ */
  function wireGlobal() {
    window.addEventListener('hashchange', renderRoute);

    document.addEventListener('click', e => {
      const fav = e.target.closest('[data-fav]');
      if (fav) {
        e.preventDefault(); e.stopPropagation();
        const id = fav.getAttribute('data-fav');
        if (state.favorites.includes(id)) state.favorites = state.favorites.filter(x => x !== id);
        else state.favorites = [id].concat(state.favorites);
        saveState();
        fav.classList.toggle('on', state.favorites.includes(id));
        fav.innerHTML = icon(state.favorites.includes(id) ? 'starFill' : 'star');
        uiSound('click');
        if (state.route === 'arcade') refreshArcadeGrid();
        return;
      }
      const game = e.target.closest('[data-game]');
      if (game) {
        if (game.tagName === 'A' && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return;
        e.preventDefault();
        openGame(game.getAttribute('data-game'));
        return;
      }
      const close = e.target.closest('[data-close]');
      if (close) {
        const kind = close.getAttribute('data-close');
        if (kind === 'game') closeGame();
        if (kind === 'palette') closePalette();
        return;
      }
      if (e.target.closest('#cmdOpen')) { openPalette(); return; }
      if (e.target.closest('#soundBtn')) {
        settings.sound = !settings.sound; saveSettings();
        const btn = $('#soundBtn');
        if (btn) btn.style.opacity = settings.sound ? '1' : '.42';
        toast('UI sound ' + (settings.sound ? 'on' : 'off'), '', settings.sound ? 'ok' : 'warn');
        uiSound('click');
      }
    });

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); openPalette(); return;
      }
      if (e.key === 'Escape') {
        if ($('#palette') && $('#palette').classList.contains('open')) closePalette();
        else if ($('#gameModal') && $('#gameModal').classList.contains('open')) closeGame();
        return;
      }
      const pal = $('#palette');
      if (pal && pal.classList.contains('open')) {
        if (e.key === 'ArrowDown') { e.preventDefault(); paletteIndex = Math.min(paletteItems.length - 1, paletteIndex + 1); renderPalette($('#paletteInput').value); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); paletteIndex = Math.max(0, paletteIndex - 1); renderPalette($('#paletteInput').value); }
        else if (e.key === 'Enter') { e.preventDefault(); runPalette(paletteIndex); }
        return;
      }
    });

    document.addEventListener('input', e => {
      if (e.target.id === 'paletteInput') { paletteIndex = 0; renderPalette(e.target.value); }
      if (e.target.id === 'arcadeSearch') {
        state.arcade.q = e.target.value;
        refreshArcadeGrid();
      }
    });

    document.addEventListener('click', e => {
      const item = e.target.closest('[data-pi]');
      if (item) runPalette(Number(item.getAttribute('data-pi')));
    });

    window.addEventListener('beforeunload', () => {
      if (bridge.ws) { try { bridge.ws.close(); } catch (e) {} }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Boot                                                               */
  /* ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.toggle('reduce-motion', !settings.motion);
    const soundBtn = $('#soundBtn');
    if (soundBtn) soundBtn.style.opacity = settings.sound ? '1' : '.42';
    wireGlobal();
    startClock();
    renderRoute();
    paintBridge();
    connectBridge();
    const n = $('#navCount');
    if (n) n.textContent = GAMES.length;
    setTimeout(() => {
      if (!GAMES.length) toast('Registry not found', 'games/registry.js must load before assets/app.js.', 'err');
    }, 1200);
  });

  /* ================================================================== */
  /*  VIEWS, dashboard                                                 */
  /* ================================================================== */
  function recentRunsBlock() {
    const recent = lastPlayed().slice(0, 3);
    if (!recent.length) return '';
    return '<div class="recent-runs"><span class="recent-label">Recently played</span>' +
      recent.map(g => '<a class="recent-run" href="' + esc(g.file) + '"><span>' + esc(g.title) + '</span><b>' +
        (bestOf(g.id) || '—') + '</b></a>').join('') +
      '</div>';
  }

  function viewDashboard() {
    return '<header class="screen-head rise">' +
      '<div class="screen-title">' +
        '<span class="eyebrow"><i class="eyebrow-dot" aria-hidden="true"></i>D Watch 7 · decoded studio</span>' +
        '<h1>The watch, decoded.</h1>' +
        '<p class="lede">Live telemetry from a $10 smartwatch that was never meant to be scriptable. Read the optical sensors and inspect every frame the firmware answers.</p>' +
        '<dl class="spec-rail">' +
          '<div><dt>Radio</dt><dd>Fr-BLE-1.0</dd></div>' +
          '<div><dt>Firmware</dt><dd>6.1.2 · 0x04</dd></div>' +
          '<div><dt>MTU</dt><dd>247 bytes</dd></div>' +
          '<div><dt>MAC</dt><dd>C2:FC:01:BC:D4:1F</dd></div>' +
        '</dl>' +
      '</div>' +
    '</header>' +

    '<div class="status-strip rise-2">' +
      '<span class="live-status" data-live="status">Offline</span>' +
      '<div class="strip-stat"><span>Battery</span><b data-live="battery">--</b>' +
        '<span class="meter" aria-hidden="true"><i data-live="batteryBar"></i></span></div>' +
      '<div class="strip-stat"><span>Keyboard</span><b data-live="profile">dodge</b></div>' +
      '<div class="strip-stat"><span>Buttons</span><b data-live="presses">0</b></div>' +
      '<div class="strip-actions">' +
        '<button class="btn btn-secondary btn-sm" id="dashConnect">' + icon('link') + ' Reconnect</button>' +
        '<button class="btn btn-ghost btn-sm" data-quick="sync">Sync time</button>' +
        '<button class="btn btn-ghost btn-sm" id="dashDisconnect">Disconnect</button>' +
      '</div>' +
    '</div>' +

    '<div class="banner rise-2" data-bridge-banner style="display:none">' +
      '<span class="bico">' + icon('link') + '</span><div><b>The watch bridge is offline.</b> Start the local bridge to read live sensors and drive the crown.</div>' +
      '<button class="btn btn-secondary btn-sm" id="dashRetry">Reconnect</button>' +
    '</div>' +

    '<div class="dash-console rise-3">' +
      '<section class="panel vitals-panel">' +
        '<div class="panel-head"><div class="head-copy"><h2>Vitals</h2>' +
          '<p class="panel-sub">One-shot optical reads. Every value here is a command, not a stream.</p></div>' +
          '<span class="tag">Live</span></div>' +
        '<div class="vitals">' +
          '<div class="vital"><span class="vital-label"><span class="pulse-dot" id="heroBeat" aria-hidden="true"></span>Heart rate</span>' +
            '<span class="vital-value"><b data-live="hr">--</b><i>bpm</i></span>' +
            '<span class="vital-note">CMD 0x06 / 0x04</span></div>' +
          '<div class="vital"><span class="vital-label">Blood oxygen</span>' +
            '<span class="vital-value"><b data-live="spo2">--</b><i>%</i></span>' +
            '<span class="vital-note">CMD 0x03 / 0x02</span></div>' +
          '<div class="vital"><span class="vital-label">Blood pressure</span>' +
            '<span class="vital-value"><b data-live="bp">--/--</b><i>mmHg</i></span>' +
            '<span class="vital-note">CMD 0x03 / 0x01</span></div>' +
          '<div class="vital"><span class="vital-label">Battery</span>' +
            '<span class="vital-value"><b data-live="battery">--</b><i>%</i></span>' +
            '<span class="vital-note">0x2A19 · read-only</span></div>' +
        '</div>' +
        '<div class="vitals-trace">' + hrSparkSVG() + '</div>' +
      '</section>' +

      '<section class="panel commands-panel">' +
        '<div class="panel-head"><h2>Wrist commands</h2><span class="tag">Watch API</span></div>' +
        '<div class="panel-body">' +
          '<div class="cmd-list">' +
            '<button class="action" data-quick="hr"><span class="ico">' + icon('heart') + '</span><b>Heart rate</b><span>Optical · 20 s</span></button>' +
            '<button class="action" data-quick="bp"><span class="ico">' + icon('gauge') + '</span><b>Blood pressure</b><span>Optical · 25 s</span></button>' +
            '<button class="action" data-quick="sync"><span class="ico">' + icon('clock') + '</span><b>Sync time</b><span>0x02 / 0x08</span></button>' +
            '<button class="action" data-quick="notify"><span class="ico">' + icon('bell') + '</span><b>Notify</b><span>0x0A / 0x00</span></button>' +
          '</div>' +
          '<p class="fine">Write <code>0x2AAD</code>, notify <code>0x2AAC</code>. Every inbound DF frame is ACKed automatically. With no watch attached the list stays honest and idle.</p>' +
        '</div>' +
      '</section>' +
    '</div>' +

    '<div class="dash-lower rise-4">' +
      '<section class="panel">' +
        '<div class="panel-head"><h2>Hardware dossier</h2><span class="tag">Verified</span></div>' +
        '<div class="panel-body">' +
          '<div class="live-row"><span class="k">Model</span><span class="v">D Watch 7</span></div>' +
          '<div class="live-row"><span class="k">SoC and radio</span><span class="v">Freqchip Fr-BLE-1.0</span></div>' +
          '<div class="live-row"><span class="k">Firmware</span><span class="v">6.1.2, dev 0x04</span></div>' +
          '<div class="live-row"><span class="k">BLE MAC</span><span class="v">C2:FC:01:BC:D4:1F</span></div>' +
          '<div class="live-row"><span class="k">Command port</span><span class="v">0x2AAD</span></div>' +
          '<div class="live-row"><span class="k">Notify port</span><span class="v">0x2AAC</span></div>' +
          '<div class="live-row"><span class="k">Frame</span><span class="v">9-byte DF header</span></div>' +
          '<div class="live-row"><span class="k">Motion</span><span class="v warn">No G-sensor stream</span></div>' +
          '<p class="fine">Full evidence trail in <a href="#/story" class="accent">the decode</a> and <code>docs/PROTOCOL.md</code>.</p>' +
        '</div>' +
      '</section>' +

      '<section class="panel arcade-panel">' +
        '<span class="eyebrow">Arcade</span>' +
        '<h2>Twenty games, one wrist</h2>' +
        '<p>The watch cannot run code, so the games run here, driven by the same three buttons.</p>' +
        '<dl class="arcade-stats">' +
          '<div><dt>Games</dt><dd>' + GAMES.length + '</dd></div>' +
          '<div><dt>Played</dt><dd>' + playCount() + '</dd></div>' +
          '<div><dt>Bests</dt><dd>' + bestCount() + '</dd></div>' +
        '</dl>' +
        recentRunsBlock() +
        '<a class="btn btn-primary" href="#/arcade">' + icon('play') + ' Open the arcade</a>' +
      '</section>' +
    '</div>' +

    '<div class="callout rise-4">' +
      '<b>Nothing leaves this machine.</b> The bridge is a thin Python layer over Bleak that speaks the DF frame codec, keeps the BLE link alive, and forwards sensor reads. This page reads that stream over a local WebSocket.' +
    '</div>' + foot();
  }

  function afterDashboard() {
    const retry = $('#dashRetry');
    if (retry) retry.addEventListener('click', () => { settings.autoconnect = true; saveSettings(); connectBridge(true); });
    const again = $('#dashConnect');
    if (again) again.addEventListener('click', () => { settings.autoconnect = true; saveSettings(); connectBridge(true); });
    const disc = $('#dashDisconnect');
    if (disc) disc.addEventListener('click', () => { disconnectBridge(); toast('Bridge disconnected', 'Auto-connect is off. Re-enable it in Manage.', 'warn'); });

    $$('[data-quick]').forEach(btn => btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-quick');
      if (q === 'hr') requestHr();
      else if (q === 'bp') requestBp();
      else if (q === 'sync') syncTime();
      else if (q === 'notify') sendNotification('WristLab', 'Hello from the studio', 'Decoded, rebuilt, playable.');
    }));

    drawSpark();
  }

  /* ================================================================== */
  /*  VIEWS, arcade                                                    */
  /* ================================================================== */
  function viewArcade() {
    const featured = BY_ID.get('star-drifter') || GAMES.find(g => g.featured) || GAMES[0];
    return pageHead('WristLab Arcade',
      'Twenty browser games built on a shared canvas engine. Play with a keyboard or pointer; if the watch bridge is connected, its media buttons work too.',
      '<div class="lib-stat"><b>' + GAMES.length + '</b><span>games</span></div>') +
      '<div id="arcadeFeatured">' + (featured ? featuredBlock(featured) : '') + '</div>' +
      '<div class="section-head"><div><h2>The library</h2></div>' +
        '<div class="side"><span class="mono tiny dim" id="arcadeCount">' + GAMES.length + ' games</span></div></div>' +
      '<div class="filters">' +
        '<div class="chip-row" id="arcadeChips">' +
          CATS.map(c => '<button class="chip' + (state.arcade.cat === c ? ' active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('') +
          '<button class="chip' + (state.arcade.cat === 'Favourites' ? ' active' : '') + '" data-cat="Favourites">' + icon('starFill') + ' Favourites</button>' +
        '</div>' +
        '<label class="search">' + icon('search') +
          '<input id="arcadeSearch" placeholder="Search titles, tags, mechanics..." value="' + esc(state.arcade.q) + '" autocomplete="off"></label>' +
      '</div>' +
      '<div class="game-grid" id="arcadeGrid"></div>' +
      '<div class="callout" style="margin-top:30px"><b>Wrist controls:</b> connect the bridge and the watch\'s Previous / Play / Next media buttons map to left / action / right inside every game. No game needs a special build.</div>' +
      foot();
  }

  function refreshArcadeGrid() {
    const grid = $('#arcadeGrid');
    if (!grid) return;
    const cat = state.arcade.cat;
    const q = (state.arcade.q || '').trim().toLowerCase();
    let list = GAMES.slice();
    if (cat === 'Favourites') list = list.filter(g => state.favorites.includes(g.id));
    else if (cat !== 'All') list = list.filter(g => g.category === cat);
    if (q) {
      list = list.filter(g => [g.title, g.tagline, g.category, (g.tags || []).join(' '), g.desc]
        .join(' ').toLowerCase().includes(q));
    }
    $$('.chip[data-cat]').forEach(c => c.classList.toggle('active', c.getAttribute('data-cat') === cat));
    const count = $('#arcadeCount');
    if (count) count.textContent = list.length + (list.length === 1 ? ' game' : ' games') + (q ? ', “' + state.arcade.q + '”' : '');
    const feat = $('#arcadeFeatured');
    if (feat) feat.style.display = (cat === 'All' && !q) ? '' : 'none';
    if (!list.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><b>No run matches that.</b>' +
        (cat === 'Favourites' ? 'Star a game with the ' + icon('star') + ' button and it lands here.' : 'Try a shorter query or a different category.') +
        '<div style="margin-top:14px"><button class="btn btn-secondary btn-sm" id="arcadeReset">Reset filters</button></div></div>';
      const reset = $('#arcadeReset');
      if (reset) reset.addEventListener('click', () => {
        state.arcade = { cat: 'All', q: '' };
        const s = $('#arcadeSearch'); if (s) s.value = '';
        refreshArcadeGrid();
      });
      return;
    }
    grid.innerHTML = list.map(g => gameCard(g, GAMES.indexOf(g))).join('');
  }

  function afterArcade() {
    refreshArcadeGrid();
    $$('#arcadeChips .chip').forEach(chip => chip.addEventListener('click', () => {
      state.arcade.cat = chip.getAttribute('data-cat');
      uiSound('click');
      refreshArcadeGrid();
    }));
  }

  /* ================================================================== */
  /*  VIEWS, lab                                                       */
  /* ================================================================== */
  function viewLab() {
    const logHtml = labLog.map(logRow).join('');
    return pageHead(
      'Poke the watch. Safely.',
      'The bridge is a thin Python layer around Bleak and the DF frame codec. Everything here talks to the real device on <span class="mono">ws://127.0.0.1:8780</span>: optical sensors, notifications, dials and raw frames. Offline, the UI still renders and explains itself.',
      '<span class="badge ' + (bridge.status === 'online' ? 'ok' : 'warn') + '" data-live="status">Offline</span>') +
      '<div class="banner" data-bridge-banner><span class="bico">' + icon('link') + '</span><div><b>Bridge offline.</b> Run <span class="mono">start.bat</span> (or <span class="mono">python dashboard_server.py</span>) and keep the watch nearby. Commands below will no-op until the socket is live.</div>' +
        '<button class="btn btn-secondary btn-sm" id="labReconnect">Reconnect</button></div>' +

      '<div class="lab-grid">' +

      '<section class="panel">' +
        '<div class="panel-head"><h3>Link status</h3><span class="tag">0x18AC</span></div>' +
        '<div class="panel-body">' +
          '<div class="live-row"><span class="k">WebSocket bridge</span><span class="v" data-live="status">Offline</span></div>' +
          '<div class="live-row"><span class="k">BLE link</span><span class="v" data-live="status">Offline</span></div>' +
          '<div class="live-row"><span class="k">Battery, 0x2A19</span><span class="v" data-live="battery">--</span></div>' +
          '<div class="live-row"><span class="k">Device</span><span class="v mono" style="font-size:var(--text-xs)">D Watch 7</span></div>' +
          '<div class="live-row"><span class="k">Firmware</span><span class="v">6.1.2, ver 0x04</span></div>' +
          '<div class="live-row"><span class="k">MAC</span><span class="v mono" style="font-size:var(--text-xs)">C2:FC:01:BC:D4:1F</span></div>' +
          '<div class="live-row"><span class="k">Last watch button</span><span class="v mono" style="font-size:var(--text-xs)" data-live="lastButton">none</span></div>' +
          '<div class="field-row" style="margin-top:14px">' +
            '<button class="btn btn-secondary btn-sm" id="simLeft">Sim left</button>' +
            '<button class="btn btn-secondary btn-sm" id="simAction">Sim action</button>' +
            '<button class="btn btn-secondary btn-sm" id="simRight">Sim right</button>' +
          '</div>' +
          '<p class="hint" style="margin-top:8px">Use these to test the browser side without the watch. If they move the game, the chain from server to browser works.</p>' +
          '<div class="live-row"><span class="k">Keyboard profile</span><span class="v" data-live="profile">--</span></div>' +
          '<div class="field-row" style="margin-top:14px">' +
            '<button class="btn btn-primary btn-sm" id="labReconnect2">Reconnect</button>' +
            '<button class="btn btn-secondary btn-sm" id="labDisconnect">Disconnect</button>' +
            '<button class="btn btn-ghost btn-sm" id="labCopyMac">Copy MAC</button>' +
          '</div>' +
          '<p class="hint" style="margin-top:10px">TX <span class="accent">00002AAD</span>, RX <span class="accent">00002AAC</span>, MTU 247, every inbound DF is ACKed automatically.</p>' +
        '</div>' +
      '</section>' +

      '<section class="panel">' +
        '<div class="panel-head"><h3>Optical sensors</h3><span class="tag">CMD 0x06 / 0x03</span></div>' +
        '<div class="panel-body">' +
          '<div class="sensor-grid">' +
            '<div class="sensor hr" data-sensor="hr"><span>HEART RATE</span><b data-live="hr">--</b><small>BPM</small></div>' +
            '<div class="sensor spo2" data-sensor="spo2"><span>SPO₂</span><b data-live="spo2">--</b><small>PERCENT</small></div>' +
            '<div class="sensor bp" data-sensor="bp"><span>BLOOD PRESSURE</span><b data-live="bp" style="font-size:19px">--/--</b><small>MMHG</small></div>' +
          '</div>' +
          '<div class="field-row" style="margin-top:14px">' +
            '<button class="btn btn-primary btn-sm" id="labHr">' + icon('heart') + ' Measure HR</button>' +
            '<button class="btn btn-secondary btn-sm" id="labBp">' + icon('gauge') + ' Measure BP</button>' +
          '</div>' +
          '<p class="hint" style="margin-top:10px">One-shot reads, not a live stream. Hold still for 20 to 25 s. Not medical-grade, just a toy sensor with a real photodiode.</p>' +
        '</div>' +
      '</section>' +

      '<section class="panel">' +
        '<div class="panel-head"><h3>Time &amp; notifications</h3><span class="tag">CMD 0x02 / 0x0A</span></div>' +
        '<div class="panel-body">' +
          '<div class="live-row"><span class="k">Local clock</span><span class="v big" id="liveClock">--:--:--</span></div>' +
          '<div class="live-row"><span class="k">Packed format</span><span class="v mono" style="font-size:var(--text-xs)">Y-2000&lt;&lt;2 | M | D | H | M | S</span></div>' +
          '<button class="btn btn-secondary btn-block btn-sm" id="labSync" style="margin-top:12px">' + icon('clock') + ' Sync watch time</button>' +
          '<div class="field" style="margin-top:16px"><label>Notification app</label><input id="notifApp" value="WristLab"></div>' +
          '<div class="field-row"><div class="field"><label>Title</label><input id="notifTitle" value="Decoded"></div>' +
            '<div class="field"><label>Body</label><input id="notifBody" value="Hello from the studio."></div></div>' +
          '<button class="btn btn-secondary btn-block btn-sm" id="labNotify">' + icon('bell') + ' Push notification</button>' +
          '<div class="field" style="margin-top:16px"><label>Watch face code</label><div class="field-row">' +
            '<input id="dialCode" value="0002" placeholder="0001"><button class="btn btn-secondary btn-sm" id="dialApply">Apply</button></div></div>' +
          '<p class="hint" style="margin-top:8px">Dial changes are rate-limited by firmware, so keep to a few per session.</p>' +
        '</div>' +
      '</section>' +

      '<section class="panel lab-span-2">' +
        '<div class="panel-head"><h3>Raw frame console</h3><span class="tag">DF codec</span></div>' +
        '<div class="panel-body">' +
          '<div class="field-row">' +
            '<div class="field"><label>CMD (hex)</label><input id="rawCmd" value="06" maxlength="4"></div>' +
            '<div class="field"><label>KEY (hex)</label><input id="rawKey" value="00" maxlength="4"></div>' +
            '<div class="field"><label>VER (hex)</label><input id="rawVer" value="04" maxlength="4"></div>' +
            '<div class="field" style="flex:2"><label>PAYLOAD (hex bytes)</label><input id="rawPayload" value="01" placeholder="01 00 ..."></div>' +
          '</div>' +
          '<div class="frame-diagram" id="frameDiagram"></div>' +
          '<div class="copy-box" style="margin-bottom:10px"><span id="frameHex">DF ...</span><button id="frameCopy">Copy</button></div>' +
          '<div class="field-row">' +
            '<button class="btn btn-primary btn-sm" id="rawSend">Send frame</button>' +
            '<span class="hint" id="frameHint" style="align-self:center"></span>' +
          '</div>' +
          '<p class="hint" style="margin-top:10px">len = payload + 5, checksum = sum of every byte except index 3. The server rebuilds and writes the frame to 2AAD, then ACKs whatever the watch returns.</p>' +
        '</div>' +
      '</section>' +

      '<section class="panel lab-span-2">' +
        '<div class="panel-head"><h3>Event log</h3><div class="side"><button class="tiny-btn" id="logCopy">Copy</button> <button class="tiny-btn" id="logDownload">Download</button> <button class="tiny-btn" id="logClear">Clear</button></div></div>' +
        '<div class="panel-body"><div class="log" id="labLog">' + logHtml + '</div></div>' +
      '</section>' +

      '<section class="panel safety lab-span-2">' +
        '<div class="panel-head"><h3>Safety rails</h3><span class="tag">Read before sending</span></div>' +
        '<div class="panel-body"><ul>' +
          '<li><b>Never</b> send <code>0x02 / 0x2A</code> (restoreFactory) or <code>0x02 / 0x2B</code> (unbindDevice).</li>' +
          '<li><code>0x02 / 0x09 to 0x0E</code> is reserved; <code>0x08 / 0x01</code> unbinds. The raw console is a loaded tool.</li>' +
          '<li>Always ACK inbound DF frames, the bridge does this automatically, or the watch goes silent.</li>' +
          '<li><code>0x05 / *</code> answers nothing and wedges the link for 30 to 60 s. It is excluded from every game loop.</li>' +
          '<li>Dial changes: ≤ 8 per run, then a 5 to 10 minute cooldown.</li>' +
        '</ul></div>' +
      '</section>' +
      '</div>' + foot();
  }

  function afterLab() {
    const reconnect = () => { settings.autoconnect = true; saveSettings(); connectBridge(true); };
    ['#labReconnect', '#labReconnect2'].forEach(sel => { const b = $(sel); if (b) b.addEventListener('click', reconnect); });
    const disc = $('#labDisconnect');
    if (disc) disc.addEventListener('click', () => { disconnectBridge(); toast('Bridge disconnected', 'Auto-connect is now off. Re-enable it in Manage.', 'warn'); });
    const mac = $('#labCopyMac');
    if (mac) mac.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText('C2:FC:01:BC:D4:1F'); toast('MAC copied', 'C2:FC:01:BC:D4:1F', 'ok'); }
      catch (e) { toast('Copy failed', 'Clipboard permission was denied.', 'err'); }
    });

    const hr = $('#labHr'); if (hr) hr.addEventListener('click', requestHr);
    const bp = $('#labBp'); if (bp) bp.addEventListener('click', requestBp);
    const sync = $('#labSync'); if (sync) sync.addEventListener('click', syncTime);

    ['left', 'action', 'right'].forEach(btn => {
      const el = $('#sim' + btn.charAt(0).toUpperCase() + btn.slice(1));
      if (el) el.addEventListener('click', () => {
        if (send({ type: 'simulate_button', button: btn })) logLine('tx', 'Simulate button, ' + btn);
        else needsBridge();
      });
    });

    const notify = $('#labNotify');
    if (notify) notify.addEventListener('click', () => {
      const app = ($('#notifApp') || {}).value || 'WristLab';
      const title = ($('#notifTitle') || {}).value || 'Hello';
      const body = ($('#notifBody') || {}).value || '';
      sendNotification(app, title, body);
    });

    const dial = $('#dialApply');
    if (dial) dial.addEventListener('click', () => {
      const code = (($('#dialCode') || {}).value || '0002').trim();
      if (!/^[0-9a-fA-F]{2,16}$/.test(code)) { toast('Invalid dial code', 'Use 2 to 8 hex bytes, e.g. 0002.', 'err'); return; }
      if (send({ type: 'set_dial', code: code })) { toast('Dial requested', 'Code ' + code + ' sent.', 'ok'); logLine('tx', 'Dial, ' + code); }
      else needsBridge();
    });

    ['#rawCmd', '#rawKey', '#rawVer', '#rawPayload'].forEach(sel => {
      const n = $(sel); if (n) n.addEventListener('input', updateFramePreview);
    });
    updateFramePreview();
    const copyFrame = $('#frameCopy');
    if (copyFrame) copyFrame.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('#frameHex').textContent); toast('Frame copied', '', 'ok'); }
      catch (e) { toast('Copy failed', '', 'err'); }
    });
    const sendRaw = $('#rawSend');
    if (sendRaw) sendRaw.addEventListener('click', () => {
      const f = readFrameForm();
      if (!f) return;
      if (send({ type: 'raw_frame', cmd: f.cmd, key: f.key, ver: f.ver, payload: f.payloadHex })) {
        toast('Raw frame sent', f.hex, 'ok');
        logLine('tx', f.hex.toUpperCase());
      } else needsBridge();
    });
    const logCopy = $('#logCopy');
    if (logCopy) logCopy.addEventListener('click', async () => {
      const txt = labLog.map(r => '[' + r.t + '] ' + r.kind.toUpperCase() + ' ' + r.msg).join('\n');
      try { await navigator.clipboard.writeText(txt); toast('Log copied', labLog.length + ' rows.', 'ok'); }
      catch (e) { toast('Copy failed', '', 'err'); }
    });
    const logDl = $('#logDownload');
    if (logDl) logDl.addEventListener('click', () => {
      const txt = labLog.map(r => '[' + r.t + '] ' + r.kind.toUpperCase() + ' ' + r.msg).join('\n');
      const blob = new Blob([txt], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'wristlab-session.log';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Log downloaded', 'wristlab-session.log', 'ok');
    });
    const logClear = $('#logClear');
    if (logClear) logClear.addEventListener('click', () => {
      labLog.length = 0;
      const box = $('#labLog'); if (box) box.innerHTML = '';
      logLine('sys', 'Log cleared');
    });

    logLine('sys', 'Protocol Lab ready, bridge ' + (bridge.status === 'online' ? 'online' : 'offline'));
    updateClock();
  }

  function hexBytes(hex) {
    const s = String(hex || '').replace(/[^0-9a-fA-F]/g, '');
    if (s.length % 2) throw new Error('Payload has an odd number of hex digits');
    const out = [];
    for (let i = 0; i < s.length; i += 2) out.push(parseInt(s.substr(i, 2), 16));
    return out;
  }

  function buildFrame(cmd, key, ver, payload) {
    const len = payload.length + 5;
    const raw = [0xDF, (len >> 8) & 255, len & 255, 0, cmd & 255, ver & 255, key & 255,
      (payload.length >> 8) & 255, payload.length & 255].concat(payload);
    let sum = 0;
    for (let i = 0; i < raw.length; i++) if (i !== 3) sum += raw[i];
    raw[3] = sum & 255;
    return raw;
  }

  function readFrameForm() {
    const hint = $('#frameHint');
    try {
      const cmd = parseInt(($('#rawCmd') || {}).value || '06', 16);
      const key = parseInt(($('#rawKey') || {}).value || '00', 16);
      const ver = parseInt(($('#rawVer') || {}).value || '04', 16);
      const payloadHex = (($('#rawPayload') || {}).value || '').trim();
      if (![cmd, key, ver].every(n => Number.isFinite(n) && n >= 0 && n <= 255)) throw new Error('CMD/KEY/VER must be 0x00 to 0xFF');
      const payload = hexBytes(payloadHex);
      if (payload.length > 240) throw new Error('Payload is too long for one frame');
      const raw = buildFrame(cmd, key, ver, payload);
      if (hint) { hint.textContent = 'valid, ' + payload.length + ' payload bytes'; hint.style.color = 'var(--lime)'; }
      return { cmd, key, ver, payloadHex, raw, hex: raw.map(b => pad2(b.toString(16))).join(' ').toUpperCase() };
    } catch (e) {
      if (hint) { hint.textContent = e.message; hint.style.color = 'var(--danger)'; }
      return null;
    }
  }

  function updateFramePreview() {
    const f = readFrameForm();
    const hexEl = $('#frameHex');
    if (hexEl) hexEl.textContent = f ? f.hex : '--';
    if (!f) return;
    const labels = ['HDR', 'LEN', 'LEN', 'SUM', 'CMD', 'VER', 'KEY', 'DLEN', 'DLEN'];
    let html = f.raw.slice(0, 9).map((b, i) =>
      '<div class="byte ' + (i === 0 ? 'hdr' : i === 3 ? 'chk' : '') + '"><b>' + pad2(b.toString(16)).toUpperCase() + '</b><span>' + labels[i] + '</span></div>').join('');
    if (f.raw.length > 9) {
      const rest = f.raw.slice(9, 15).map(b => '<div class="byte"><b>' + pad2(b.toString(16)).toUpperCase() + '</b><span>DATA</span></div>').join('');
      html += rest + (f.raw.length > 15 ? '<div class="byte"><b>...</b><span>+' + (f.raw.length - 15) + '</span></div>' : '');
    }
    const d = $('#frameDiagram');
    if (d) d.innerHTML = html;
  }

  /* ================================================================== */
  /*  VIEWS, story                                                     */
  /* ================================================================== */
  let storyObserver = null;

  function viewStory() {
    return '<div class="story-hero rise">' +
      '<h1>The watch that would not run apps.</h1>' +
      '<p class="lead">A cheap Chinese smartwatch, a decompiled Android app, 6,293 probed command pairs, one dead accelerometer, and a media-key trick that turned a locked-down wearable into a game controller. This is the honest version, including everything that did not work.</p>' +
      '<div class="hero-meta" style="border-top:none;padding-top:0">' +
        '<div class="meta-item"><span>Device</span><b>D Watch 7</b></div>' +
        '<div class="meta-item"><span>Firmware</span><b>6.1.2, Freqchip</b></div>' +
        '<div class="meta-item"><span>Companion</span><b>M2Wear 6.1.38</b></div>' +
        '<div class="meta-item"><span>Status</span><b>Decoded, playable</b></div>' +
      '</div>' +
    '</div>' +

    '<div class="story-layout">' +
      '<aside class="story-nav" aria-label="Story contents">' +
        '<div class="sl">Contents</div>' +
        '<a href="#origin" data-scroll="origin">01, The itch</a>' +
        '<a href="#method" data-scroll="method">02, Method</a>' +
        '<a href="#frame" data-scroll="frame">03, The frame</a>' +
        '<a href="#confirmed" data-scroll="confirmed">04, What works</a>' +
        '<a href="#deadends" data-scroll="deadends">05, Dead ends</a>' +
        '<a href="#breakthrough" data-scroll="breakthrough">06, The breakthrough</a>' +
        '<a href="#now" data-scroll="now">07, What I\'m building</a>' +
        '<a href="#next" data-scroll="next">08, What\'s next</a>' +
        '<a href="#docs" data-scroll="docs">09, Documents</a>' +
      '</aside>' +

      '<div class="prose">' +

      '<section id="origin">' +
        '<h2>01, A watch with a sealed brain</h2>' +
        '<p>The <b>D Watch 7</b> is a ~$10 wearable sold under a dozen names. It has a 240×280 screen, a buzzer, an optical heart-rate sensor, Bluetooth 5, and a companion app called <b>M2Wear</b> (<span class="mono">com.lianhezhuli.mtwear</span>). It does not have an app store, a JavaScript runtime, or any documented way to run your own code.</p>' +
        '<p>I wanted to know one thing: <b>what is the watch actually saying over Bluetooth?</b> If I could speak its protocol, maybe I could make it do something the stock firmware never intended. That question turned into months of probing, decompiling, and building.</p>' +
        '<div class="callout"><b>The core constraint:</b> the firmware only runs its stock UI. There is no SDK, no sideloading, no custom watch app. Everything in this studio is built around what the hardware <em>does</em> expose, BLE commands, the motor, the sensors, and the watch\'s media buttons.</div>' +
        '<div class="frame-diagram" style="margin-top:18px">' +
          '<div class="byte hdr"><b>D Watch 7</b><span>DEVICE</span></div>' +
          '<div class="byte"><b>Fr-BLE-1.0</b><span>RADIO</span></div>' +
          '<div class="byte"><b>6.1.2</b><span>FIRMWARE</span></div>' +
          '<div class="byte"><b>247</b><span>MTU</span></div>' +
          '<div class="byte"><b>0x04</b><span>DEV VER</span></div>' +
        '</div>' +
      '</section>' +

      '<section id="method">' +
        '<h2>02, Six ways in, one at a time</h2>' +
        '<p>I did not start with a protocol spec, none exists publicly. I built the map from the outside in, using four sources that could correct each other:</p>' +
        '<div class="steps">' +
          '<div class="step"><div><b>Enumerate the GATT tree.</b><span>A Python + Bleak script connected to the watch and dumped every service and characteristic. Two vendor characteristics stood out: <code>00002AAD</code> accepted writes, <code>00002AAC</code> pushed notifications. Writing to the notify characteristic silently failed. That was the first real clue.</span></div></div>' +
          '<div class="step"><div><b>Decompile the companion app.</b><span>JADX opened M2Wear 6.1.38. The classes <code>NotifyWriteUtils</code>, <code>BleDataUtils</code> and the protocol constant tables showed the frame layout, the bind handshake, the health decoders, and the exact OTA envelope. Source code became the hypothesis engine.</span></div></div>' +
          '<div class="step"><div><b>Capture real traffic.</b><span>With the official app connected, I logged every write and notification while tapping through the UI. That gave me real frames with real checksums and showed that the link dies unless you <b>ACK every inbound DF frame</b>. Silence is the only trustworthy signal.</span></div></div>' +
          '<div class="step"><div><b>Build an ACK-aware probe.</b><span>My first sweep was useless because unacknowledged frames killed the link. Once the probe ACKed everything, commands became measurable: an answer, a reject, or silence. Silence turned out to be the only trustworthy signal.</span></div></div>' +
          '<div class="step"><div><b>Sweep the command space.</b><span>6,293 command/key pairs, 6,560 frames sent: <b>6,228 answered</b>, only command <code>0x05</code> went fully silent. Pair-level rejects were almost always a generic link-level frame, not a real “no”.</span></div></div>' +
          '<div class="step"><div><b>Verify on hardware.</b><span>Every claim in the protocol doc was replayed against the watch: bind, battery, notifications, dial switch, health reads, time sync. If it did not physically happen, it did not go in the docs.</span></div></div>' +
        '</div>' +
        '<p class="muted" style="margin-top:14px">The hierarchy matters: live hardware beats decompiled source, and decompiled source beats old notes. Every conflict was resolved in that order.</p>' +
      '</section>' +

      '<section id="frame">' +
        '<h2>03, Eleven bytes that run the watch</h2>' +
        '<p>Every command is a <b>DF frame</b>. The first byte is the magic, the next two are a big-endian length, then a checksum, then the command, firmware version, key, and a length-prefixed payload. It is small enough to reason about by hand and strict enough to punish you for guessing.</p>' +
        '<div class="frame-diagram">' +
          '<div class="byte hdr"><b>DF</b><span>MAGIC</span></div>' +
          '<div class="byte"><b>00</b><span>LEN HI</span></div>' +
          '<div class="byte"><b>09</b><span>LEN LO</span></div>' +
          '<div class="byte chk"><b>E1</b><span>CHECKSUM</span></div>' +
          '<div class="byte"><b>02</b><span>CMD</span></div>' +
          '<div class="byte"><b>04</b><span>DEV VER</span></div>' +
          '<div class="byte"><b>08</b><span>KEY</span></div>' +
          '<div class="byte"><b>00</b><span>DLEN HI</span></div>' +
          '<div class="byte"><b>04</b><span>DLEN LO</span></div>' +
          '<div class="byte"><b>6A 8B 4D A5</b><span>PAYLOAD</span></div>' +
        '</div>' +
        '<pre><span class="c">// length = payload length + 5</span>\n' +
        '<span class="c">// checksum = sum of every byte except index 3, &amp; 0xFF</span>\n' +
        '<span class="k">DF</span> <span class="n">00 09</span> <span class="o">E1</span> <span class="n">02</span> <span class="n">04</span> <span class="n">08</span> <span class="n">00 04</span> 6A 8B 4D A5\n' +
        '<span class="c">// the frame above is a real time-sync command: 02/08, four packed bytes</span></pre>' +
        '<p>Inbound frames use the same shape; status replies use <code>FD 00 06 checksum cmd ver key 00 01 status</code>. Split notifications have to be reassembled until <code>len + 4</code> bytes arrive. The ACK is a nine-byte FD frame with no checksum byte, get it wrong and the watch goes quiet mid-conversation.</p>' +
        '<div class="callout warn"><b>Why the old docs were wrong:</b> the length field counts the payload plus five, not “bytes after the header”; and the ACK is not a DF echo. Both mistakes make every frame look valid in a hex dump while the watch ignores it.</div>' +
      '</section>' +

      '<section id="confirmed">' +
        '<h2>04, The hardware I can actually drive</h2>' +
        '<p>These are verified against the physical watch, not inferred from source. They are the primitives the studio is built on.</p>' +
        '<div class="doc-grid">' +
          docCard('heart', 'Heart rate', '0x06 / 0x04 trigger, 0x03 / 0x00 read', '#confirmed') +
          docCard('gauge', 'Blood pressure', '0x06 / 0x05 trigger, 0x03 / 0x01 read', '#confirmed') +
          docCard('droplet', 'SpO₂', '0x06 / 0x06 trigger, 0x03 / 0x02 read', '#confirmed') +
          docCard('bell', 'Notifications', '0x0A / 0x00, app, title, body, timestamp', '#confirmed') +
          docCard('clock', 'Time sync', '0x02 / 0x08, four packed time bytes', '#confirmed') +
          docCard('watch', 'Watch faces', '0x0B / 0x03, 24+ built-in dial codes', '#confirmed') +
          docCard('shake', 'Wrist shake', '0x06 / 0x01 arm, 0x06 / 0x02 event', '#confirmed') +
        '</div>' +
        '<p>The watch also exposes battery over the standard <code>0x180F / 0x2A19</code>, plus device information strings that identify the Freqchip radio. Bind is <code>0x08 / 0x00</code> with an eight-character payload; the reply tells you whether the watch accepted, was already bound, or rejected the session.</p>' +
        '<div class="callout"><span class="badge dead">Not usable</span> &nbsp; The motor is a buzzer that blocks the link for 30 to 60 seconds after one command, so the studio does not drive it. The protocol command is documented, the feature is not shipped.</div>' +
      '</section>' +

      '<section id="deadends">' +
        '<h2>05, What the firmware refused to do</h2>' +
        '<p>Honest reverse engineering is mostly negative results. Three of them defined the project.</p>' +
        '<h3>The accelerometer will not stream</h3>' +
        '<p>The <code>0x28</code> game-sensor command is acknowledged, prepare, start, exit all return <code>FD</code>, but not a single <code>0x28 / 0x01</code> X/Y/Z frame ever arrives. The companion app has the same problem: its feature parser needs a reply of at least 36 bytes before it enables motion sensing, and our watch\'s feature reply is only 18 bytes. The 60 Hz G-sensor engine is not compiled into firmware 6.1.2. <span class="badge dead">DEAD</span></p>' +
        '<h3>The wallpaper container is opaque</h3>' +
        '<p>Custom watch faces use a <code>PAR</code> container built inside the native library <code>libabpartool.so</code>. The captured blobs are still unreadable, and this unit reports <code>supportDiyOnlineWpaper=false</code>, so even a perfect decoder would be refused. <span class="badge warn">Blocked by firmware</span></p>' +
        '<h3>Command 0x05 is a trap</h3>' +
        '<p>Every key under <code>cmd 0x05</code> goes silent and wedges the BLE link for 30 to 60 seconds. It is the only command family that behaved that way across the full sweep, and it is permanently denylisted. <span class="badge dead">Do not send</span></p>' +
        '<p class="muted">I also decoded video (<code>0x2B</code>) and firmware-log (<code>0x24</code>) paths from source but never exercised them live. They are documented as unverified, not sold as features.</p>' +
      '</section>' +

      '<section id="breakthrough">' +
        '<h2>06, The watch was already a controller</h2>' +
        '<p>The firmware would not run my code and the accelerometer would not stream, so the input had to come from somewhere else. It came from the Music screen. The watch pairs as an audio remote over AVRCP. When you press Previous / Play / Next, Windows receives a media command through <b>System Media Transport Controls</b>, no BLE protocol work required. I registered a silent looping media player, listened for those button events, and measured roughly <b>0.19 s</b> from thumb to browser.</p>' +
        '<div class="callout"><b>Previous left. Play/Pause action. Next right.</b> Three physical buttons, low latency, zero firmware modification. The browser supplies the screen and sound; the watch supplies the buttons.</div>' +
        '<p>The browser is the console, the Python bridge is the cartridge slot, and the watch is the controller. No jailbreak, no OTA, no custom firmware.</p>' +
        '<div class="timeline">' +
          '<div class="tl-item"><span class="date">Phase 01</span><div class="what"><b>GATT dump</b><span>Found 2AAD / 2AAC, battery, device info, OTA channel.</span></div></div>' +
          '<div class="tl-item"><span class="date">Phase 02</span><div class="what"><b>JADX decompile</b><span>Frame layout, bind handshake, health decode, dial table.</span></div></div>' +
          '<div class="tl-item"><span class="date">Phase 03</span><div class="what"><b>Live capture</b><span>Real frames, real checksums, the ACK-or-silence rule.</span></div></div>' +
          '<div class="tl-item"><span class="date">Phase 04</span><div class="what"><b>6,293-pair sweep</b><span>6,228 answers. Command 0x05 isolated as hostile.</span></div></div>' +
          '<div class="tl-item"><span class="date">Phase 05</span><div class="what"><b>Tilt verdict</b><span>No streaming engine in this ROM. Pivot required.</span></div></div>' +
          '<div class="tl-item"><span class="date">Phase 06</span><div class="what"><b>Media-key bridge</b><span>AVRCP + SMTC = three low-latency buttons.</span></div></div>' +
          '<div class="tl-item"><span class="date">Phase 07</span><div class="what"><b>WristLab</b><span>20 games, sensors, protocol lab, this story.</span></div></div>' +
        '</div>' +
      '</section>' +

      '<section id="now">' +
        '<h2>07, A studio I can keep extending</h2>' +
        '<p>Most reverse-engineering projects end as a folder of scripts. I wanted the work to become something a person can actually use, and something I can keep extending without rewriting the protocol layer.</p>' +
        '<p><b>WristLab</b> is that product. It has five surfaces:</p>' +
        '<ul>' +
          '<li><b>Dashboard</b>, the live watch, battery, heart rate, recent runs, and one-tap hardware actions.</li>' +
          '<li><b>Arcade</b>, 20 original games across arcade, action, puzzle, rhythm and strategy, all registered in one metadata file.</li>' +
          '<li><b>Protocol Lab</b>, a real command console: optical sensors, notifications, time sync, dial codes, raw DF frames and a live event log.</li>' +
          '<li><b>The Decode</b>, this page, plus the full technical documents.</li>' +
          '<li><b>Manage</b>, settings, per-game stats, data export, reset, and the three-step recipe for adding a game.</li>' +
        '</ul>' +
        '<h3>The architecture in one paragraph</h3>' +
        '<p><span class="mono">games/engine.js</span> is a dependency-free canvas runtime: fixed 960×600 stage, responsive scaling, WebAudio synth, particles, screen shake, unified input, localStorage high scores, and a WebSocket bridge to the watch. Every game is a single HTML file that calls <code>WristGame.mount({...})</code>. <span class="mono">games/registry.js</span> is the only place the UI learns a game exists. <span class="mono">dashboard_server.py</span> serves the studio, bridges BLE through Bleak, ACKs frames, and publishes state to every open tab on port 8780.</p>' +
        '<div class="callout"><b>Adding a game is three steps:</b> copy <span class="mono">games/template.html</span>, write the update/draw loop, add one object to <span class="mono">games/registry.js</span>. The arcade, search, filters, high scores, dashboard and manager pick it up automatically.</div>' +
        '<h3>Why 20 games instead of 7 prototypes</h3>' +
        '<p>The first generation of watch games were one-off experiments with different input models and no shared score contract. Rebuilding them on one engine proved the abstraction: the same wrist buttons, the same lifecycle can support a snake game, a rhythm runner, a 2048 board and a turn-based artillery duel. If the engine holds under 20 genres, it will hold under the next 20.</p>' +
      '</section>' +

      '<section id="next">' +
        '<h2>08, The open problems</h2>' +
        '<ul>' +
          '<li><b>True HR streaming.</b> Right now health is one-shot. If firmware 6.1.2 can be coaxed into a live push, or if the standard <code>0x2A37</code> characteristic appears, games can react to stress in real time instead of sampling between rounds.</li>' +
          '<li><b>Wallpaper / PAR.</b> The native encoder is the missing piece. Without it, custom dials stay blocked; with it, the watch could display generated art.</li>' +
          '<li><b>OTA, carefully.</b> The OTA envelope and CRC-8 are documented, but flashing a $10 watch with a half-understood image is how you brick it. This stays read-only until there is a recovery path.</li>' +
          '<li><b>More input.</b> Wrist-shake works as a discrete event. A game that uses it as a deliberate “boost” gesture is the next experiment.</li>' +
          '<li><b>Mobile.</b> The studio is responsive, but the bridge is a Windows process. A phone-first companion is a different product decision.</li>' +
        '</ul>' +
        '<div class="callout danger"><b>Safety is part of the protocol.</b> The bridge denylists factory-reset and unbind commands, rate-limits dial changes, ACKs every inbound frame, and never probes <code>0x05</code> in a game loop. The raw console is powerful; the rails are deliberate.</div>' +
      '</section>' +

      '<section id="docs">' +
        '<h2>09, Read the primary sources</h2>' +
        '<p>The studio is the demo. These files are the evidence: verified protocol, hardware grading, the merged findings, OTA notes and the open questions.</p>' +
        '<div class="doc-grid">' +
          docCard('file', 'PROTOCOL.md', 'Master verified protocol, GATT, DF/FD, commands, payloads', 'docs/PROTOCOL.md') +
          docCard('cpu', 'WATCH_SPEC.md', 'Hardware spec with evidence grades', 'docs/WATCH_SPEC.md') +
          docCard('compass', 'MERGED_PROTOCOL_AND_FINDINGS.md', 'Single-source merged findings + verdicts', 'docs/MERGED_PROTOCOL_AND_FINDINGS.md') +
          docCard('signal', 'OTA.md', 'OTA envelope, CRC-8, group/file CRC', 'docs/OTA.md') +
          docCard('archive', 'CONTEXT.md', 'Project context and tool inventory', 'docs/CONTEXT.md') +
          docCard('help', 'NEXT_TESTS.md', 'The honest experiment list', 'docs/research/NEXT_TESTS.md') +
        '</div>' +
        '<p class="muted" style="margin-top:16px">Everything not verified is deliberately kept out of the product. The decompiled APK, BLE logs, capture blobs, sweep journals, old toolchains and legacy pages stay in a local archive so the story remains auditable.</p>' +
        '<div class="hero-cta" style="margin-top:20px"><a class="btn btn-primary" href="#/arcade">' + icon('play') + ' Use the thing</a><a class="btn btn-secondary" href="#/lab">Open the lab</a></div>' +
      '</section>' +

      '</div>' +
    '</div>' + foot();
  }

  function docCard(name, title, text, href) {
    return '<a class="doc-card" href="' + esc(href) + '" target="_blank" rel="noopener">' +
      '<span class="ico">' + icon(name) + '</span><span><b>' + esc(title) + '</b><span>' + esc(text) + '</span></span></a>';
  }

  function afterStory() {
    if (storyObserver) { storyObserver.disconnect(); storyObserver = null; }
    const links = $$('.story-nav a[data-scroll]');
    links.forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const t = document.getElementById(a.getAttribute('data-scroll'));
      if (t) t.scrollIntoView({ behavior: settings.motion ? 'smooth' : 'auto', block: 'start' });
    }));
    const secs = $$('.prose section');
    if ('IntersectionObserver' in window && secs.length) {
      storyObserver = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          const id = en.target.id;
          links.forEach(a => a.classList.toggle('active', a.getAttribute('data-scroll') === id));
        });
      }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
      secs.forEach(s => storyObserver.observe(s));
    }
  }

  /* ================================================================== */
  /*  VIEWS, manage                                                    */
  /* ================================================================== */
  function viewManage() {
    const storage = storageBytes();
    const rows = GAMES.map(g => {
      const best = bestOf(g.id), plays = state.plays[g.id] || 0;
      return '<tr><td><span class="gname"><span class="gicon" style="--chip-bg:' + esc(g.accent2) + '">' + gameIcon(g.id) + '</span>' +
        '<span><b style="font-size:12.5px;font-weight:600">' + esc(g.title) + '</b><br><span class="tiny dim mono">' + esc(g.category) + '</span></span></span></td>' +
        '<td class="score">' + (best || '--') + '</td>' +
        '<td class="mono tiny">' + (plays || 0) + '</td>' +
        '<td><button class="tiny-btn" data-game="' + esc(g.id) + '">Play</button></td></tr>';
    }).join('');

    return pageHead(
      'Keep the workbench tidy.',
      'Settings, per-game records, data export, reset tools and the recipe for extending the arcade. Everything here is local to this browser, the only network traffic is the WebSocket to your own machine.',
      '<span class="badge info">Local only</span>') +

      '<div class="grid-2">' +
        '<section class="panel">' +
          '<div class="panel-head"><h3>Preferences</h3><span class="tag">This browser</span></div>' +
          '<div class="panel-body">' +
            toggleRow('sound', 'Interface sound', 'Tiny synthesized clicks on navigation and actions.', settings.sound) +
            toggleRow('motion', 'Motion & animation', 'Page rises, floating art and smooth scrolling. Turn off for a still UI.', settings.motion) +
            toggleRow('autoconnect', 'Auto-connect bridge', 'Keep retrying ws://127.0.0.1:8780 while this tab is open.', settings.autoconnect) +
            '<p class="hint" style="margin-top:12px">Game audio is controlled inside each game (sound button). Mute state is shared across the arcade.</p>' +
          '</div>' +
        '</section>' +

        '<section class="panel">' +
          '<div class="panel-head"><h3>Your data</h3><span class="tag">Local storage</span></div>' +
          '<div class="panel-body">' +
            '<div class="data-readouts">' +
              '<div class="data-readout"><b>' + bestCount() + '<em>/' + GAMES.length + '</em></b><span>Records set</span></div>' +
              '<div class="data-readout"><b>' + playCount() + '</b><span>Total runs</span></div>' +
              '<div class="data-readout"><b>' + totalBest() + '</b><span>Sum of bests</span></div>' +
              '<div class="data-readout"><b>' + (storage < 1024 ? storage + ' B' : (storage / 1024).toFixed(1) + ' KB') + '</b><span>Storage used</span></div>' +
            '</div>' +
            '<div class="field-row">' +
              '<button class="btn btn-secondary btn-sm" id="exportData">' + icon('download') + ' Export JSON</button>' +
              '<button class="btn btn-ghost btn-sm" id="clearHistory">Clear recents</button>' +
            '</div>' +
            '<p class="hint" style="margin-top:12px">High scores live under <span class="mono">wristlab_&lt;id&gt;_best</span>; UI state under <span class="mono">wristlab_ui_*</span>. Nothing leaves this browser.</p>' +
          '</div>' +
        '</section>' +
      '</div>' +

      '<div class="section-head"><div><h2>Every game, every record</h2></div>' +
        '<div class="side"><span class="mono tiny dim">' + GAMES.length + ' entries</span></div></div>' +
      '<section class="panel"><div class="panel-body table-wrap"><table class="table">' +
        '<thead><tr><th>Game</th><th>Best</th><th>Runs</th><th></th></tr></thead><tbody>' + rows + '</tbody>' +
      '</table></div></section>' +

      '<div class="section-head"><div><h2>Add the twenty-first game</h2></div></div>' +
      '<div class="grid-2">' +
        '<section class="panel">' +
          '<div class="panel-head"><h3>Three steps</h3><span class="tag">Engine API</span></div>' +
          '<div class="panel-body"><div class="steps">' +
            '<div class="step"><div><b>Copy the template</b><span><span class="mono">games/template.html</span> already wires the engine, overlays, sound and bridge.</span></div></div>' +
            '<div class="step"><div><b>Write update + draw</b><span>Mutate <span class="mono">g</span> in <span class="mono">update(g, dt)</span>, paint with the canvas helpers in <span class="mono">draw(g, ctx)</span>. Read input from <span class="mono">g.keys</span>, <span class="mono">g.pointer</span> and <span class="mono">onAction</span>.</span></div></div>' +
            '<div class="step"><div><b>Register it</b><span>Add one object to <span class="mono">games/registry.js</span>. Arcade, search, dashboard, stats and filters read from that array.</span></div></div>' +
          '</div>' +
          '<div class="copy-box" style="margin-top:14px"><span>copy games/template.html games/my-game.html</span><button id="copyTemplate">Copy</button></div>' +
          '</div>' +
        '</section>' +
        '<section class="panel">' +
          '<div class="panel-head"><h3>Engine contract</h3><span class="tag">games/engine.js</span></div>' +
          '<div class="panel-body">' +
            '<div class="live-row"><span class="k">mount(def)</span><span class="v mono" style="font-size:var(--text-xs)">id, title, accent, init, update, draw</span></div>' +
            '<div class="live-row"><span class="k">state</span><span class="v mono" style="font-size:var(--text-xs)">score, best, time, state</span></div>' +
            '<div class="live-row"><span class="k">input</span><span class="v mono" style="font-size:var(--text-xs)">keys, pointer, tilt, onAction</span></div>' +
            '<div class="live-row"><span class="k">feedback</span><span class="v mono" style="font-size:var(--text-xs)">sfx(), burst(), shake()</span></div>' +
            '<div class="live-row"><span class="k">lifecycle</span><span class="v mono" style="font-size:var(--text-xs)">start(), over(), restart()</span></div>' +
            '<div class="live-row"><span class="k">storage</span><span class="v mono" style="font-size:var(--text-xs)">g.storage.get / set</span></div>' +
            '<p class="hint" style="margin-top:12px">Games never touch the bridge directly, the engine owns the WebSocket and maps watch buttons.</p>' +
          '</div>' +
        '</section>' +
      '</div>' +

      '<div class="section-head"><div><h2>What lives where</h2></div></div>' +
      '<div class="doc-grid">' +
        docCard('arcade', 'games/', 'engine.js, registry.js, template + 20 game files', 'games/registry.js') +
        docCard('server', 'dashboard_server.py', 'HTTP + dual WebSocket bridge + Bleak BLE worker', 'dashboard_server.py') +
        docCard('file', 'docs/', 'Verified protocol, spec, OTA, merged findings', 'docs/PROTOCOL.md') +
      '</div>' +

      '<section class="panel danger-zone" style="margin-top:26px">' +
        '<div class="panel-head"><h3>Danger zone</h3><span class="tag">Irreversible</span></div>' +
        '<div class="panel-body">' +
          '<div class="settings-row"><div class="lbl"><b>Reset all high scores</b><span>Clears every <span class="mono">wristlab_&lt;id&gt;_best</span> entry. Games remain.</span></div><button class="btn btn-danger btn-sm" id="resetScores">Reset scores</button></div>' +
          '<div class="settings-row"><div class="lbl"><b>Clear recents &amp; play counts</b><span>Forgets what you launched. Records stay.</span></div><button class="btn btn-danger btn-sm" id="resetActivity">Clear activity</button></div>' +
          '<div class="settings-row"><div class="lbl"><b>Wipe all WristLab data</b><span>Scores, settings, history, favourites. Cannot be undone.</span></div><button class="btn btn-danger btn-sm" id="resetAll">Wipe everything</button></div>' +
        '</div>' +
      '</section>' +

      '<section class="panel" style="margin-top:14px">' +
        '<div class="panel-head"><h3>First run on the watch</h3><span class="tag">Start here</span></div>' +
        '<div class="panel-body"><div class="steps">' +
          '<div class="step"><div><b>Start the bridge</b><span>Double-click <span class="mono">start.bat</span> (Windows). It installs nothing automatically; it runs <span class="mono">dashboard_server.py</span> and opens this studio.</span></div></div>' +
          '<div class="step"><div><b>Wake the watch</b><span>Keep it within a few metres. The bridge scans for <span class="mono">C2:FC:01:BC:D4:1F</span> and reconnects forever.</span></div></div>' +
          '<div class="step"><div><b>Pair the audio remote once</b><span>On Windows, pair <span class="mono">D Watch7-Audio</span>. The watch\'s music buttons then drive every game.</span></div></div>' +
        '</div></div>' +
      '</section>' + foot();
  }

  function toggleRow(key, title, desc, on) {
    return '<div class="settings-row"><div class="lbl"><b>' + esc(title) + '</b><span>' + desc + '</span></div>' +
      '<button class="toggle' + (on ? ' on' : '') + '" data-toggle="' + key + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + esc(title) + '"></button></div>';
  }

  function storageBytes() {
    let n = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('wristlab_') === 0) n += k.length + (localStorage.getItem(k) || '').length;
      }
    } catch (e) {}
    return n;
  }

  function afterManage() {
    $$('[data-toggle]').forEach(btn => btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-toggle');
      settings[key] = !settings[key];
      saveSettings();
      btn.classList.toggle('on', settings[key]);
      btn.setAttribute('aria-checked', settings[key] ? 'true' : 'false');
      uiSound('click');
      if (key === 'sound') {
        const sb = $('#soundBtn'); if (sb) sb.style.opacity = settings.sound ? '1' : '.42';
      }
      if (key === 'motion') document.body.classList.toggle('reduce-motion', !settings.motion);
      if (key === 'autoconnect') {
        if (settings.autoconnect) connectBridge(true); else disconnectBridge();
      }
    }));

    const exp = $('#exportData');
    if (exp) exp.addEventListener('click', () => {
      const bests = {};
      GAMES.forEach(g => { bests[g.id] = bestOf(g.id); });
      const data = {
        app: 'WristLab', exported: new Date().toISOString(), settings,
        history: state.history, plays: state.plays, favorites: state.favorites, bests,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'wristlab-data.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Data exported', 'wristlab-data.json', 'ok');
    });

    const ch = $('#clearHistory');
    if (ch) ch.addEventListener('click', () => {
      state.history = []; state.plays = {}; saveState();
      toast('Activity cleared', 'Recents and play counts are gone.', 'ok');
      renderRoute();
    });

    const cp = $('#copyTemplate');
    if (cp) cp.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText('copy games/template.html games/my-game.html'); toast('Command copied', '', 'ok'); }
      catch (e) { toast('Copy failed', '', 'err'); }
    });

    const rs = $('#resetScores');
    if (rs) rs.addEventListener('click', () => {
      if (!window.confirm('Reset all 20 high scores? This cannot be undone.')) return;
      GAMES.forEach(g => { try { localStorage.removeItem('wristlab_' + g.id + '_best'); } catch (e) {} });
      toast('Scores reset', 'Every personal best was cleared.', 'warn');
      renderRoute();
    });

    const ra = $('#resetActivity');
    if (ra) ra.addEventListener('click', () => {
      if (!window.confirm('Clear recents and play counts?')) return;
      state.history = []; state.plays = {}; saveState();
      toast('Activity cleared', '', 'warn');
      renderRoute();
    });

    const rall = $('#resetAll');
    if (rall) rall.addEventListener('click', () => {
      if (!window.confirm('Wipe every WristLab key in this browser? Scores, settings, recents and favourites will be lost.')) return;
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf('wristlab_') === 0) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
      } catch (e) {}
      toast('Everything wiped', 'Reloading a clean studio...', 'warn');
      setTimeout(() => location.reload(), 900);
    });
  }
})();
