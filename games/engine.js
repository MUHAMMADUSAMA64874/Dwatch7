/* ==========================================================================
   WRISTLAB ARCADE ENGINE
   A tiny, dependency-free canvas game runtime for watch-driven web games.
   Every game is a self-contained HTML file that calls WristGame.mount({...}).
   ========================================================================== */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const DEFAULTS = {
    width: 960,
    height: 600,
    accent: '#c9f56b',
    bg: '#08090b',
    channel: 'dodge',
    controls: [],
    tips: [],
  };

  const LS = {
    get(k, d) {
      try { const v = localStorage.getItem('wristlab_' + k); return v === null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem('wristlab_' + k, JSON.stringify(v)); } catch (e) {}
    },
  };

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  const angle = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
  const hsv = (h, s = 100, l = 50) => `hsl(${h} ${s}% ${l}%)`;

  /* ------------------------------------------------------------------ */
  /*  AUDIO — procedural WebAudio synth, no assets required              */
  /* ------------------------------------------------------------------ */
  class Sound {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = LS.get('muted', false);
      this.volume = LS.get('volume', 0.7);
      this.musicTimer = null;
      this.musicGain = null;
      this.music = null;
      this.step = 0;
    }
    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    setMuted(v) {
      this.muted = !!v;
      LS.set('muted', this.muted);
      if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    }
    setVolume(v) {
      this.volume = clamp(v, 0, 1);
      LS.set('volume', this.volume);
      if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    }
    tone(freq, dur = 0.1, type = 'sine', vol = 0.2, opt = {}) {
      const ctx = this.ensure();
      if (!ctx || this.muted) return;
      const t0 = ctx.currentTime + (opt.delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (opt.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.slide), t0 + dur);
      const a = opt.attack || 0.005;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + a);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain); gain.connect(this.master);
      osc.start(t0); osc.stop(t0 + dur + 0.03);
    }
    noise(dur = 0.2, vol = 0.2, filterFreq = 1200, opt = {}) {
      const ctx = this.ensure();
      if (!ctx || this.muted) return;
      const t0 = ctx.currentTime + (opt.delay || 0);
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = opt.type || 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, t0);
      if (opt.sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(80, opt.sweep), t0 + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter); filter.connect(gain); gain.connect(this.master);
      src.start(t0); src.stop(t0 + dur + 0.02);
    }
    chord(freqs, dur = 0.25, type = 'triangle', vol = 0.08) {
      freqs.forEach((f, i) => this.tone(f, dur, type, vol, { delay: i * 0.015 }));
    }
    sfx(name) {
      switch (name) {
        case 'click': this.tone(520, 0.05, 'square', 0.10); break;
        case 'blip': this.tone(760, 0.06, 'triangle', 0.13); break;
        case 'coin': this.tone(900, 0.05, 'square', 0.14); this.tone(1360, 0.10, 'square', 0.11, { delay: 0.055 }); break;
        case 'tick': this.tone(1200, 0.025, 'square', 0.07); break;
        case 'jump': this.tone(300, 0.16, 'triangle', 0.16, { slide: 720 }); break;
        case 'laser': this.tone(1400, 0.12, 'sawtooth', 0.10, { slide: 260 }); break;
        case 'hit': this.noise(0.18, 0.3, 900, { sweep: 180 }); this.tone(120, 0.18, 'square', 0.12, { slide: 60 }); break;
        case 'explode': this.noise(0.5, 0.42, 1400, { sweep: 100 }); this.tone(90, 0.4, 'sawtooth', 0.12, { slide: 40 }); break;
        case 'power': this.tone(440, 0.08, 'square', 0.13); this.tone(660, 0.08, 'square', 0.13, { delay: 0.07 }); this.tone(990, 0.16, 'square', 0.11, { delay: 0.14 }); break;
        case 'win': this.chord([523, 659, 784, 1046], 0.4, 'triangle', 0.09); break;
        case 'lose': this.tone(420, 0.2, 'sawtooth', 0.14, { slide: 180 }); this.tone(210, 0.45, 'sawtooth', 0.12, { slide: 70, delay: 0.16 }); break;
        case 'whoosh': this.noise(0.35, 0.16, 2400, { sweep: 300, type: 'bandpass' }); break;
        case 'pop': this.tone(600, 0.07, 'sine', 0.18, { slide: 1100 }); break;
        case 'buzzer': this.tone(160, 0.5, 'sawtooth', 0.12); break;
        default: this.tone(600, 0.06, 'sine', 0.1);
      }
    }
    startMusic(cfg) {
      this.stopMusic();
      const ctx = this.ensure();
      if (!ctx) return;
      this.music = Object.assign({ root: 196, scale: [0, 3, 5, 7, 10], bpm: 108, wave: 'triangle', gain: 0.05 }, cfg || {});
      const m = this.music;
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 1;
      this.musicGain.connect(this.master);
      this.step = 0;
      const stepMs = 60000 / m.bpm / 4;
      this.musicTimer = setInterval(() => this._musicStep(), stepMs);
      this._musicStep();
    }
    _musicStep() {
      const ctx = this.ctx, m = this.music;
      if (!ctx || !m || this.muted) { this.step = (this.step + 1) % 32; return; }
      const s = this.step % 16;
      const scale = m.scale;
      const deg = scale[s % scale.length] + (s >= 8 ? 12 : 0);
      const freq = m.root * Math.pow(2, deg / 12);
      if (s % 4 === 0) this._musicNote(m.root / 2, 0.32, m.wave, m.gain * 1.15);
      if (s % 2 === 0) this._musicNote(freq, 0.14, m.wave, m.gain);
      if (s % 8 === 4) this._musicNote(freq * 1.5, 0.2, 'sine', m.gain * 0.8);
      this.step = (this.step + 1) % 32;
    }
    _musicNote(freq, dur, wave, vol) {
      const ctx = this.ctx; if (!ctx || this.muted) return;
      const t0 = ctx.currentTime + 0.01;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = wave; osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(this.musicGain);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    }
    stopMusic() {
      if (this.musicTimer) clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  WATCH BRIDGE — WebSocket to dashboard_server.py (port 8780)        */
  /* ------------------------------------------------------------------ */
  class WatchBridge {
    constructor(game) {
      this.game = game;
      this.ws = null;
      this.connected = false;
      this.retry = null;
      this.state = { online: false, battery: null, hr: null, spo2: null, bp: null };
      this.connect();
    }
    url() {
      const q = new URLSearchParams(location.search);
      if (q.get('ws')) return q.get('ws');
      const host = location.hostname || '127.0.0.1';
      return `ws://${host}:8780`;
    }
    connect() {
      try { this.ws = new WebSocket(this.url()); } catch (e) { this.schedule(); return; }
      this.ws.onopen = () => {
        this.connected = true;
        this.game._setWatchDot(true);
        this.send({ type: 'set_profile', profile: 'none', keyboard_emulation: false });
        this.send({ type: 'set_button_action', action: 'game' });
      };
      this.ws.onclose = () => {
        this.connected = false;
        this.game._setWatchDot(false);
        this.schedule();
      };
      this.ws.onerror = () => { try { this.ws.close(); } catch (e) {} };
      this.ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        const g = this.game;
        if (m.type === 'status') {
          this.state.online = !!m.connected;
          if (m.battery != null) this.state.battery = m.battery;
          g._setWatchDot(!!m.connected);
          g.watch.online = !!m.connected;
          g.watch.battery = this.state.battery;
        } else if (m.type === 'battery') {
          this.state.battery = m.level; g.watch.battery = m.level;
        } else if (m.type === 'heartrate') {
          if (m.bpm) { this.state.hr = m.bpm; g.watch.hr = m.bpm; }
          if (m.spo2) { this.state.spo2 = m.spo2; g.watch.spo2 = m.spo2; }
          if (m.bp_high) { this.state.bp = m.bp_high; g.watch.bp = m.bp_high; }
        } else if (m.type === 'button' && m.button) {
          const map = { left: 'left', right: 'right', action: 'action', up: 'up', down: 'down' };
          const a = map[m.button] || m.button;
          if (a) {
            if (!g.keys.has(a)) g.keys.add(a);
          }
          g._dispatch(a, true);
          setTimeout(() => {
            if (a) g.keys.delete(a);
            g._dispatch(a, false);
          }, 90);
        } else if (m.type === 'sensor' || m.type === 'tilt') {
          g.tilt.x = m.x || 0; g.tilt.y = m.y || 0; g.tilt.z = m.z || 0;
        } else if (m.type === 'watch_event') {
          const keyMap = { 1: 'left', 2: 'action', 3: 'right' };
          const a = keyMap[m.key];
          if (a) {
            if (!g.keys.has(a)) g.keys.add(a);
            g._dispatch(a, true);
            setTimeout(() => { g.keys.delete(a); g._dispatch(a, false); }, 90);
          }
        }
      };
    }
    schedule() {
      if (this.retry) return;
      this.retry = setTimeout(() => { this.retry = null; this.connect(); }, 3500);
    }
    send(obj) {
      if (this.ws && this.ws.readyState === 1) {
        try { this.ws.send(JSON.stringify(obj)); return true; } catch (e) {}
      }
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  ENGINE                                                             */
  /* ------------------------------------------------------------------ */
  class Game {
    constructor(def) {
      this.def = Object.assign({}, DEFAULTS, def);
      this.W = this.def.width; this.H = this.def.height;
      this.time = 0; this.dt = 0; this.score = 0; this.best = 0;
      this.state = 'ready';
      this.last = 0; this._raf = null;
      this.keys = new Set();
      this.pointer = { x: 0, y: 0, down: false, justDown: false, justUp: false };
      this.particles = [];
      this.shakeT = 0; this.shakeAmp = 0;
      this.tilt = { x: 0, y: 0, z: 0 };
      this.watch = { online: false, battery: null, hr: null, spo2: null, bp: null };
      this.detail = '';
      this.audio = new Sound();
      this.storage = {
        get: (k, d) => LS.get(this.def.id + '_' + k, d),
        set: (k, v) => LS.set(this.def.id + '_' + k, v),
      };
      this.best = this.storage.get('best', 0) || 0;

      // Utility helpers exposed on the game instance so games can call
      // g.clamp(), g.rand(), g.pick(), g.dist() without extra imports.
      this.clamp = clamp;
      this.lerp = lerp;
      this.rand = rand;
      this.randInt = randInt;
      this.pick = pick;
      this.dist = dist;
      this.angle = angle;
      this.hsv = hsv;
      this.TAU = TAU;

      // Ensure the browser does not request /favicon.ico (404 noise in the console).
      if (!document.querySelector('link[rel="icon"]')) {
        const icon = document.createElement('link');
        icon.rel = 'icon';
        icon.href = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22%3E%3Crect width=%2216%22 height=%2216%22 rx=%224%22 fill=%22%2308090b%22/%3E%3Ccircle cx=%228%22 cy=%228%22 r=%225%22 fill=%22%23c9f56b%22/%3E%3C/svg%3E';
        document.head.appendChild(icon);
      }

      this._buildDOM();
      this._bindInput();
      this.bridge = new WatchBridge(this);
      this._setWatchDot(false);
      this._updateHud();
      if (typeof this.def.init === 'function') this.def.init(this);
      this.last = performance.now();
      this._loop = this._loop.bind(this);
      this._raf = requestAnimationFrame(this._loop);
      setTimeout(() => this._resize(), 0);
    }

    /* ---------------- DOM ---------------- */
    _buildDOM() {
      const d = this.def;
      document.body.classList.add('wg-body');
      const embed = new URLSearchParams(location.search).get('embed') === '1';
      document.body.classList.toggle('wg-embed', embed);
      document.body.innerHTML = '';
      const root = document.createElement('div');
      root.className = 'wg-root' + (embed ? ' wg-embed' : '');
      root.style.setProperty('--wg-accent', d.accent);
      root.innerHTML = `
        <header class="wg-bar">
          <a class="wg-back" href="../index.html#/arcade" title="Back to arcade">
            <span class="wg-back-ico">←</span><span class="wg-back-txt">Arcade</span>
          </a>
          <div class="wg-id">
            <span class="wg-dot" id="wgDot" title="Watch bridge"></span>
            <span class="wg-name">${escapeHtml(d.title || 'WristLab Game')}</span>
            <span class="wg-tag">${escapeHtml(d.tagline || '')}</span>
          </div>
          <div class="wg-scores">
            <div class="wg-score"><span>SCORE</span><b id="wgScore">0</b></div>
            <div class="wg-score"><span>BEST</span><b id="wgBest">0</b></div>
          </div>
          <div class="wg-tools">
            <button class="wg-btn" id="wgSound" title="Toggle sound">♪</button>
            <button class="wg-btn" id="wgPause" title="Pause (P)">❚❚</button>
            <button class="wg-btn" id="wgFull" title="Fullscreen">⛶</button>
          </div>
        </header>
        <main class="wg-stage" id="wgStage">
          <canvas class="wg-canvas" id="wgCanvas"></canvas>
          <div class="wg-vignette"></div>
          <div class="wg-overlay" id="wgOverlay"></div>
        </main>
      `;
      document.body.appendChild(root);
      this.root = root;
      this.stage = root.querySelector('#wgStage');
      this.canvas = root.querySelector('#wgCanvas');
      this.overlay = root.querySelector('#wgOverlay');
      this.ctx = this.canvas.getContext('2d');
      this.dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      this.canvas.width = this.W * this.dpr;
      this.canvas.height = this.H * this.dpr;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      root.querySelector('#wgSound').addEventListener('click', e => {
        e.stopPropagation();
        this.audio.setMuted(!this.audio.muted);
        this._syncSoundBtn();
        if (!this.audio.muted) this.audio.sfx('click');
      });
      root.querySelector('#wgPause').addEventListener('click', e => { e.stopPropagation(); this.togglePause(); });
      root.querySelector('#wgFull').addEventListener('click', e => { e.stopPropagation(); this._fullscreen(); });
      this._syncSoundBtn();
      window.addEventListener('resize', () => this._resize());
      this._resize();
      this._showStart();
    }
    _syncSoundBtn() {
      const b = this.root && this.root.querySelector('#wgSound');
      if (b) { b.textContent = this.audio.muted ? '🔇' : '♪'; b.classList.toggle('off', this.audio.muted); }
    }
    _resize() {
      if (!this.stage) return;
      const r = this.stage.getBoundingClientRect();
      const scale = Math.min((r.width - 28) / this.W, (r.height - 28) / this.H);
      const s = Math.max(0.2, scale);
      this.canvas.style.width = Math.round(this.W * s) + 'px';
      this.canvas.style.height = Math.round(this.H * s) + 'px';
    }
    _fullscreen() {
      const el = this.root;
      if (!document.fullscreenElement) { (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); }
      else document.exitFullscreen && document.exitFullscreen();
    }
    _setWatchDot(on) {
      const dot = this.root && this.root.querySelector('#wgDot');
      if (dot) {
        dot.classList.toggle('on', !!on);
        dot.title = on ? 'Watch bridge online, wrist buttons live' : 'Watch bridge offline, keyboard / pointer controls active';
      }
    }

    /* ---------------- Overlays ---------------- */
    _showStart() {
      const d = this.def;
      const controls = (d.controls || []).map(c => `<span class="wg-chip"><b>${escapeHtml(c.keys || '')}</b>${escapeHtml(c.label || '')}</span>`).join('');
      const tips = (d.tips || []).map(t => `<li>${escapeHtml(t)}</li>`).join('');
      const genre = String(d.category || 'GAME').toUpperCase();
      const kicker = ['ARCADE', 'GAME'].includes(genre) ? 'WRISTLAB ARCADE' : `WRISTLAB ARCADE · ${genre}`;
      this.overlay.innerHTML = `
        <div class="wg-panel wg-panel-start">
          <div class="wg-kicker">${escapeHtml(kicker)}</div>
          <h1>${escapeHtml(d.title || 'WristLab Game')}</h1>
          <p class="wg-sub">${escapeHtml(d.tagline || '')}</p>
          <div class="wg-chips">${controls || '<span class="wg-chip"><b>← →</b>PLAY</span>'}</div>
          ${tips ? `<ul class="wg-tips">${tips}</ul>` : ''}
          <button class="wg-play" id="wgStart">▶ PLAY</button>
          <div class="wg-hint">Press <b>Space</b> or tap Play · watch buttons work too</div>
        </div>`;
      this.overlay.classList.add('show');
      const btn = this.overlay.querySelector('#wgStart');
      btn.addEventListener('click', () => this.start());
      this._bindOverlayKeys();
    }
    _bindOverlayKeys() {
      this._overlayKey = e => {
        if (e.code === 'Space' || e.code === 'Enter') {
          if (this.state === 'ready') { e.preventDefault(); this.start(); }
          else if (this.state === 'over') { e.preventDefault(); this.restart(); }
          else if (this.state === 'paused') { e.preventDefault(); this.togglePause(); }
        }
        if (e.code === 'KeyP' && (this.state === 'running' || this.state === 'paused')) {
          e.preventDefault(); this.togglePause();
        }
      };
      window.addEventListener('keydown', this._overlayKey);
    }
    _showOver() {
      const d = this.def;
      const isBest = this.score >= this.best && this.score > 0;
      this.overlay.innerHTML = `
        <div class="wg-panel">
          <div class="wg-kicker">${isBest ? 'NEW PERSONAL BEST' : 'RUN COMPLETE'}</div>
          <h1>${isBest ? 'Record broken' : 'Game over'}</h1>
          <div class="wg-bigscore">${Math.round(this.score)}</div>
          <p class="wg-sub">${escapeHtml(this.detail || 'Best ' + Math.round(this.best))}</p>
          <button class="wg-play" id="wgAgain">↻ PLAY AGAIN</button>
          <div class="wg-hint">Press <b>Space</b> · or <a href="../index.html#/arcade">pick another game</a></div>
        </div>`;
      this.overlay.classList.add('show');
      this.overlay.querySelector('#wgAgain').addEventListener('click', () => this.restart());
    }
    _showPause() {
      this.overlay.innerHTML = `
        <div class="wg-panel">
          <div class="wg-kicker">PAUSED</div>
          <h1>Take a breath</h1>
          <p class="wg-sub">The wrist can wait.</p>
          <button class="wg-play" id="wgResume">▶ RESUME</button>
          <div class="wg-hint">Press <b>P</b> or <b>Space</b> to resume</div>
        </div>`;
      this.overlay.classList.add('show');
      this.overlay.querySelector('#wgResume').addEventListener('click', () => this.togglePause());
    }
    _hideOverlay() { this.overlay.classList.remove('show'); this.overlay.innerHTML = ''; }

    /* ---------------- State ---------------- */
    start() {
      this.audio.ensure();
      this.audio.sfx('start');
      this.state = 'running';
      this._hideOverlay();
      if (typeof this.def.onStart === 'function') this.def.onStart(this);
    }
    restart() {
      this.score = 0; this.time = 0; this.detail = '';
      this.particles.length = 0; this.shakeT = 0; this.shakeAmp = 0;
      this.keys.clear();
      this.pointer.down = false;
      if (typeof this.def.init === 'function') this.def.init(this);
      this._updateHud();
      this.state = 'running';
      this._hideOverlay();
      this.audio.ensure();
      this.audio.sfx('start');
      if (typeof this.def.onStart === 'function') this.def.onStart(this);
    }
    togglePause() {
      if (this.state === 'running') { this.state = 'paused'; this.audio.sfx('click'); this._showPause(); }
      else if (this.state === 'paused') { this.state = 'running'; this._hideOverlay(); this.audio.sfx('click'); this.last = performance.now(); }
    }
    over(detail) {
      if (this.state === 'over') return;
      this.state = 'over';
      if (this.score > this.best) { this.best = this.score; this.storage.set('best', this.best); }
      this._updateHud();
      this.detail = detail || ('Best ' + Math.round(this.best));
      this.haptic('gameover');
      this.audio.sfx('lose');
      this.audio.stopMusic();
      this._showOver();
    }
    addScore(n) {
      this.score += n;
      this._updateHud();
    }
    setScore(n) { this.score = n; this._updateHud(); }
    _updateHud() {
      const s = this.root && this.root.querySelector('#wgScore');
      const b = this.root && this.root.querySelector('#wgBest');
      if (s) s.textContent = Math.round(this.score);
      if (b) b.textContent = Math.round(Math.max(this.best, this.score));
    }

    /* ---------------- Input ---------------- */
    _bindInput() {
      const keyMap = {
        ArrowLeft: 'left', KeyA: 'left',
        ArrowRight: 'right', KeyD: 'right',
        ArrowUp: 'up', KeyW: 'up',
        ArrowDown: 'down', KeyS: 'down',
        Space: 'action', Enter: 'action', KeyJ: 'action', KeyZ: 'action',
      };
      window.addEventListener('keydown', e => {
        const a = keyMap[e.code];
        if (a) {
          if (a === 'action' || a === 'up' || a === 'down') e.preventDefault();
          if (!this.keys.has(a)) this.keys.add(a);
          this._dispatch(a, true);
          if (this.state === 'ready' && (e.code === 'Space' || e.code === 'Enter')) this.start();
        }
      });
      window.addEventListener('keyup', e => {
        const a = keyMap[e.code];
        if (a) { this.keys.delete(a); this._dispatch(a, false); }
      });
      window.addEventListener('blur', () => { if (this.state === 'running') this.togglePause(); });

      const pos = e => {
        const r = this.canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width * this.W;
        const y = (e.clientY - r.top) / r.height * this.H;
        return { x: clamp(x, 0, this.W), y: clamp(y, 0, this.H) };
      };
      this.canvas.addEventListener('pointerdown', e => {
        e.preventDefault();
        const p = pos(e);
        this.pointer.x = p.x; this.pointer.y = p.y; this.pointer.down = true; this.pointer.justDown = true;
        this.audio.ensure();
        if (this.state === 'ready') this.start();
        if (this.state === 'running' && this.def.onPointer) this.def.onPointer(this, p.x, p.y, 'down', e);
      });
      this.canvas.addEventListener('pointermove', e => {
        const p = pos(e);
        this.pointer.x = p.x; this.pointer.y = p.y;
        if (this.def.onPointer) this.def.onPointer(this, p.x, p.y, this.pointer.down ? 'drag' : 'move', e);
      });
      window.addEventListener('pointerup', e => {
        if (!this.pointer.down) return;
        this.pointer.down = false; this.pointer.justUp = true;
        if (this.def.onPointer) this.def.onPointer(this, this.pointer.x, this.pointer.y, 'up', e);
      });
      window.addEventListener('pointercancel', () => { this.pointer.down = false; });
    }
    _dispatch(action, down) {
      if (this.state === 'ready' && down && (action === 'action' || action === 'left' || action === 'right')) { this.start(); return; }
      if (this.state === 'over' && down && action === 'action') { this.restart(); return; }
      if (this.state !== 'running') return;
      if (this.def.onAction) this.def.onAction(this, action, down);
      if (down && this.def.onDown) this.def.onDown(this, action);
      if (!down && this.def.onUp) this.def.onUp(this, action);
    }
    pressed(a) { return this.keys.has(a); }

    /* ---------------- Haptics / FX ---------------- */
    // The watch's motor is a slow buzzer that blocks the next BLE command, so vibration
    // is not a usable output. Kept as a no-op so the 99 existing game call sites still run.
    haptic() {}
    shake(amount = 6, dur = 0.25) {
      this.shakeAmp = Math.max(this.shakeAmp, amount);
      this.shakeT = Math.max(this.shakeT, dur);
    }
    burst(x, y, color, count = 18, opt = {}) {
      const spread = opt.spread == null ? 3.6 : opt.spread;
      const speed = opt.speed || 180;
      const life = opt.life || 0.8;
      const size = opt.size || 3;
      for (let i = 0; i < count; i++) {
        const a = opt.angle == null ? rand(0, TAU) : opt.angle + rand(-spread / 2, spread / 2);
        const v = rand(speed * 0.25, speed);
        this.particles.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          life: rand(life * 0.5, life), max: life,
          size: rand(size * 0.5, size), color: color || this.def.accent,
          gravity: opt.gravity == null ? 260 : opt.gravity,
          drag: opt.drag == null ? 1.6 : opt.drag,
          shape: opt.shape || 'circle',
        });
      }
      if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
    }
    _updateParticles(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) { this.particles.splice(i, 1); continue; }
        p.vy += p.gravity * dt;
        p.vx -= p.vx * p.drag * dt;
        p.vy -= p.vy * p.drag * dt * 0.4;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }
    _drawParticles(ctx) {
      for (const p of this.particles) {
        const a = clamp(p.life / p.max, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        if (p.shape === 'square') ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }

    /* ---------------- Draw helpers ---------------- */
    clear(color) {
      const ctx = this.ctx;
      ctx.fillStyle = color || this.def.bg;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    grid(color = 'rgba(255,255,255,.05)', size = 40, ox = 0, oy = 0) {
      const ctx = this.ctx;
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = ox % size; x < this.W; x += size) { ctx.moveTo(x, 0); ctx.lineTo(x, this.H); }
      for (let y = oy % size; y < this.H; y += size) { ctx.moveTo(0, y); ctx.lineTo(this.W, y); }
      ctx.stroke();
    }
    stars(count = 90, time = this.time, speed = 12) {
      const ctx = this.ctx;
      for (let i = 0; i < count; i++) {
        const seed = i * 97.13;
        const x = (seed * 13.7) % this.W;
        const y = ((seed * 7.3 + time * speed * (0.4 + (i % 5) * 0.22)) % this.H + this.H) % this.H;
        ctx.globalAlpha = 0.25 + (i % 7) * 0.09;
        ctx.fillStyle = i % 11 === 0 ? this.def.accent : '#cbd5e1';
        const r = i % 13 === 0 ? 1.8 : 1;
        ctx.fillRect(x, y, r, r);
      }
      ctx.globalAlpha = 1;
    }
    glow(x, y, r, color, blur = 24) {
      const ctx = this.ctx;
      ctx.save();
      ctx.shadowColor = color; ctx.shadowBlur = blur;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.restore();
    }
    text(str, x, y, opt = {}) {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = opt.color || '#f4f1e8';
      ctx.font = `${opt.weight || 700} ${opt.size || 16}px ${opt.font || "'Bricolage Grotesque','Segoe UI',sans-serif"}`;
      ctx.textAlign = opt.align || 'left';
      ctx.textBaseline = opt.baseline || 'alphabetic';
      if (opt.glow) { ctx.shadowColor = opt.glow; ctx.shadowBlur = opt.blur || 16; }
      if (opt.alpha != null) ctx.globalAlpha = opt.alpha;
      ctx.fillText(str, x, y);
      ctx.restore();
    }
    roundRect(x, y, w, h, r, fill, stroke, lw = 1) {
      const ctx = this.ctx;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
      else {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
      }
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
    }
    circle(x, y, r, fill, stroke, lw = 1) {
      const ctx = this.ctx;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
    }
    line(x1, y1, x2, y2, color, lw = 1) {
      const ctx = this.ctx;
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }

    /* ---------------- Loop ---------------- */
    _loop(now) {
      this._raf = requestAnimationFrame(this._loop);
      const raw = (now - this.last) / 1000;
      this.last = now;
      const dt = clamp(raw || 0.016, 0, 0.05);
      if (this.state === 'running') {
        this.dt = dt; this.time += dt;
        try { if (this.def.update) this.def.update(this, dt); } catch (e) { console.error('[WristGame] update error', e); }
        this._updateParticles(dt);
      } else {
        this.dt = 0;
      }
      this.pointer.justDown = false;
      this.pointer.justUp = false;
      this._render(dt);
    }
    _render(dt) {
      const ctx = this.ctx;
      ctx.save();
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        const k = Math.max(0, this.shakeT) * this.shakeAmp * 6;
        ctx.translate(rand(-k, k), rand(-k, k));
        if (this.shakeT <= 0) this.shakeAmp = 0;
      }
      try { if (this.def.draw) this.def.draw(this, ctx); } catch (e) { console.error('[WristGame] draw error', e); }
      this._drawParticles(ctx);
      ctx.restore();

      // subtle pause dim
      if (this.state === 'paused') {
        ctx.fillStyle = 'rgba(4,5,7,.35)';
        ctx.fillRect(0, 0, this.W, this.H);
      }
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */
  const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
  *{box-sizing:border-box}
  html,body{height:100%;margin:0}
  .wg-body{background:#06070a;color:#f4f1e8;font-family:'Bricolage Grotesque','Segoe UI',sans-serif;overflow:hidden}
  .wg-root{height:100vh;height:100dvh;display:flex;flex-direction:column;background:#06070a;}
  .wg-bar{height:56px;flex:0 0 56px;display:flex;align-items:center;gap:18px;padding:0 18px;
    border-bottom:1px solid rgba(244,241,232,.09);background:#090a0d;z-index:5}
  .wg-embed .wg-bar{display:none}
  .wg-embed .wg-canvas{border-radius:10px}
  .wg-back{display:flex;align-items:center;gap:7px;text-decoration:none;color:#9aa0a8;
    font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.08em;padding:7px 10px;border-radius:8px;border:1px solid transparent}
  .wg-back:hover{color:#f4f1e8;border-color:rgba(244,241,232,.12);background:rgba(255,255,255,.03)}
  .wg-id{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
  .wg-dot{width:8px;height:8px;border-radius:50%;background:#3a3f46;flex:0 0 8px}
  .wg-dot.on{background:var(--wg-accent)}
  .wg-name{font-weight:700;font-size:15px;letter-spacing:.01em;white-space:nowrap}
  .wg-tag{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#7b828c;letter-spacing:.08em;text-transform:uppercase;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .wg-scores{display:flex;gap:22px;align-items:center}
  .wg-score{display:flex;flex-direction:column;line-height:1}
  .wg-score span{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.14em;color:#727983}
  .wg-score b{font-family:'IBM Plex Mono',monospace;font-size:19px;font-weight:600;color:#f4f1e8}
  .wg-tools{display:flex;gap:6px}
  .wg-btn{width:34px;height:34px;border-radius:9px;border:1px solid rgba(244,241,232,.13);background:rgba(255,255,255,.03);
    color:#c9ced6;cursor:pointer;font-size:13px;display:grid;place-items:center;transition:.15s}
  .wg-btn:hover{background:rgba(255,255,255,.08);color:#fff;border-color:rgba(244,241,232,.24)}
  .wg-btn.off{opacity:.5}
  .wg-stage{position:relative;flex:1;min-height:0;display:grid;place-items:center;overflow:hidden}
  .wg-canvas{display:block;border-radius:12px;background:#08090b;border:1px solid rgba(244,241,232,.08);touch-action:none}
  .wg-vignette{display:none}
  .wg-overlay{position:absolute;inset:0;display:grid;place-items:center;padding:24px;opacity:0;pointer-events:none;transition:opacity .18s}
  .wg-overlay.show{opacity:1;pointer-events:auto;background:rgba(4,5,8,.6)}
  .wg-panel{width:min(560px,92vw);padding:32px;border-radius:14px;text-align:center;
    background:#101319;border:1px solid rgba(244,241,232,.1);animation:wgIn .18s ease both}
  @keyframes wgIn{from{opacity:0}to{opacity:1}}
  .wg-kicker{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.2em;color:var(--wg-accent);margin-bottom:14px}
  .wg-panel h1{font-size:clamp(30px,5vw,46px);line-height:.98;margin:0 0 12px;letter-spacing:-.03em;font-weight:800}
  .wg-sub{color:#a6acb5;font-size:14px;line-height:1.55;margin:0 auto 20px;max-width:42ch}
  .wg-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:18px}
  .wg-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:8px;
    border:1px solid rgba(244,241,232,.12);background:rgba(255,255,255,.03);
    font-family:'IBM Plex Mono',monospace;font-size:10px;color:#b6bcc4;letter-spacing:.03em}
  .wg-chip b{color:var(--wg-accent);font-weight:600}
  .wg-tips{text-align:left;margin:0 auto 20px;padding-left:18px;color:#8f969f;font-size:12.5px;line-height:1.7;max-width:44ch}
  .wg-tips li::marker{color:var(--wg-accent)}
  .wg-play{margin-top:4px;padding:12px 28px;border-radius:10px;border:1px solid color-mix(in srgb,var(--wg-accent) 45%,transparent);cursor:pointer;
    font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;letter-spacing:.14em;
    color:#0a0b0d;background:var(--wg-accent);transition:background-color .15s,border-color .15s}
  .wg-play:hover{filter:brightness(1.05)}
  .wg-play:active{filter:brightness(.98)}
  .wg-hint{margin-top:18px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#6f7680;letter-spacing:.03em}
  .wg-hint b{color:#c9ced6}
  .wg-hint a{color:var(--wg-accent);text-decoration:none}
  .wg-bigscore{font-family:'IBM Plex Mono',monospace;font-size:clamp(56px,10vw,92px);font-weight:600;line-height:1;
    color:var(--wg-accent);margin:8px 0 10px}
  @media (max-width:720px){
    .wg-bar{gap:10px;padding:0 10px}
    .wg-tag{display:none}.wg-back-txt{display:none}
    .wg-scores{gap:14px}.wg-score b{font-size:16px}
    .wg-panel{padding:26px 20px 22px}
  }
  `;

  /* ------------------------------------------------------------------ */
  /*  PUBLIC API                                                         */
  /* ------------------------------------------------------------------ */
  const WristGame = {
    mount(def) {
      if (!window.__wgStyle) {
        const style = document.createElement('style');
        style.id = '__wgStyle';
        style.textContent = CSS;
        document.head.appendChild(style);
        window.__wgStyle = style;
      }
      if (!document.querySelector('meta[name="viewport"]')) {
        const m = document.createElement('meta');
        m.name = 'viewport'; m.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no';
        document.head.appendChild(m);
      }
      return new Game(def);
    },
    Sound,
    util: { clamp, lerp, rand, randInt, pick, dist, angle, hsv, TAU },
  };

  window.WristGame = WristGame;
  window.WGUtil = WristGame.util;
})();
