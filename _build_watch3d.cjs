const fs = require('fs');
const body = fs.readFileSync('.watch-body.tmp.js', 'utf8');

const header = `/* WristLab - 3D D Watch 7 digital twin.
 * Ported from the original D Watch 7 studio (Three.js r140-era build) so the
 * dashboard shows the real watch model: pebble case, knurled crown, sport
 * band, optical sensor pod and a live contour dial.
 *
 * Usage:  WristWatch3D.mount(hostElement) -> api
 */
(function () {
  'use strict';
  if (!window.THREE) {
    console.warn('[watch3d] THREE is not loaded');
    return;
  }

  var state = {
    mounted: false,
    host: null,
    canvas: null,
    raf: 0,
    lastFrame: 0,
    lastSecond: -1,
    sensorUntil: 0,
    rumble: 0,
    yaw: -0.52,
    pitch: 0.08,
    targetYaw: -0.52,
    targetPitch: 0.08,
    dragging: false,
    lastX: 0,
    lastY: 0,
    autoYaw: true
  };

  var scene, camera, renderer, watchGroup, crownGroup, sideButtonMesh;
  var screenCanvas, screenCtx, screenTexture;
  var clockMode = 'live';
  var currentThemeIndex = 0;
  var crownWeight = 1.0;
  var targetCrownRotation = 0;
  var rumbleIntensity = 0;
  var rearLedMat, rearLedMesh1, rearLedMesh2, slitHaloMesh1, slitHaloMesh2, sensorPointLight;

  var dialThemes = [
    { top: '#3ec6e0', mid: '#4e8be6', bottom: '#6859ea' },
    { top: '#34d399', mid: '#10b981', bottom: '#0891b2' },
    { top: '#fbbf24', mid: '#f97316', bottom: '#e11d48' },
    { top: '#ffffff', mid: '#cbd5e1', bottom: '#64748b' }
  ];

  var VIEWS = {
    hero: { yaw: -0.52, pitch: 0.08 },
    front: { yaw: 0, pitch: 0 },
    crown: { yaw: -1.05, pitch: 0.12 },
    sensors: { yaw: Math.PI, pitch: -0.06 }
  };

`;

const footer = `

  /* ------------------------------------------------------------------ */
  /*  MOUNT / LIFECYCLE                                                  */
  /* ------------------------------------------------------------------ */
  function resize() {
    if (!state.host || !renderer || !camera) return;
    var w = state.host.clientWidth || 480;
    var h = state.host.clientHeight || 520;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
  }

  function onPointerDown(e) {
    state.dragging = true;
    state.autoYaw = false;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    if (state.canvas) state.canvas.setPointerCapture && state.canvas.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!state.dragging) return;
    var dx = e.clientX - state.lastX;
    var dy = e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.targetYaw += dx * 0.006;
    state.targetPitch = Math.max(-0.75, Math.min(0.75, state.targetPitch + dy * 0.004));
  }
  function onPointerUp() {
    state.dragging = false;
  }
  function onWheel(e) {
    if (!camera) return;
    e.preventDefault();
    camera.position.z = Math.max(5.4, Math.min(11, camera.position.z + e.deltaY * 0.004));
  }

  function faceLoop(now) {
    if (!state.mounted) return;
    state.raf = requestAnimationFrame(faceLoop);

    var t = now / 1000;

    if (!state.dragging) {
      if (state.autoYaw) state.targetYaw += 0.0012;
      state.targetYaw += 0;
    }
    state.yaw += (state.targetYaw - state.yaw) * 0.075;
    state.pitch += (state.targetPitch - state.pitch) * 0.075;

    if (watchGroup) {
      watchGroup.rotation.y = state.yaw;
      watchGroup.rotation.x = state.pitch;
      watchGroup.rotation.z = -0.04;
      watchGroup.position.y = Math.sin(t * 1.15) * 0.05;
    }

    // Optical sensor strobe while a reading is "in flight"
    var pulsing = performance.now() < state.sensorUntil;
    if (rearLedMat) {
      if (pulsing) {
        var cycle = (performance.now() % 312.5) / 312.5;
        var on = cycle < 0.45;
        rearLedMat.emissive.setHex(on ? 0x00ff66 : 0x00220a);
        rearLedMat.emissiveIntensity = on ? 4.2 : 0.08;
        rearLedMat.color.setHex(on ? 0x55ffaa : 0x004418);
        if (sensorPointLight) sensorPointLight.intensity = on ? 3.5 : 0;
        if (slitHaloMesh1) slitHaloMesh1.material.opacity = on ? 0.9 : 0.05;
        if (slitHaloMesh2) slitHaloMesh2.material.opacity = on ? 0.9 : 0.05;
      } else {
        rearLedMat.emissive.setHex(0x001a08);
        rearLedMat.emissiveIntensity = 0.05;
        rearLedMat.color.setHex(0x003314);
        if (sensorPointLight) sensorPointLight.intensity = 0;
        if (slitHaloMesh1) slitHaloMesh1.material.opacity = 0;
        if (slitHaloMesh2) slitHaloMesh2.material.opacity = 0;
      }
    }

    // Crown + contour weight
    if (crownGroup) {
      crownGroup.rotation.x += (targetCrownRotation - crownGroup.rotation.x) * 0.12;
    }
    if (Math.abs(crownWeight - 1.0) > 0.002) {
      crownWeight += (1.0 - crownWeight) * 0.08;
      updateWatchFaceCanvas();
      state.lastSecond = -1;
    }

    // Live dial, redrawn once a second
    var sec = Math.floor(Date.now() / 1000);
    if (sec !== state.lastSecond) {
      state.lastSecond = sec;
      updateWatchFaceCanvas();
    }

    // Haptic rumble
    if (rumbleIntensity > 0 && watchGroup) {
      watchGroup.position.x += (Math.random() - 0.5) * rumbleIntensity * 0.012;
      watchGroup.position.z += (Math.random() - 0.5) * rumbleIntensity * 0.012;
      rumbleIntensity *= 0.86;
      if (rumbleIntensity < 0.08) rumbleIntensity = 0;
    } else if (watchGroup) {
      watchGroup.position.x *= 0.9;
      watchGroup.position.z *= 0.9;
    }

    renderer.render(scene, camera);
  }

  function start() {
    if (state.raf) return;
    state.lastFrame = 0;
    state.raf = requestAnimationFrame(faceLoop);
  }
  function stop() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
  }
  function onVisibility() {
    if (document.hidden) stop(); else start();
  }

  function mount(host) {
    if (!host || state.mounted) return api;
    state.host = host;
    state.mounted = true;

    state.canvas = document.createElement('canvas');
    state.canvas.className = 'watch3d-canvas';
    state.canvas.setAttribute('aria-label', 'Interactive 3D model of the D Watch 7');
    state.canvas.setAttribute('role', 'img');
    host.appendChild(state.canvas);

    var w = host.clientWidth || 480;
    var h = host.clientHeight || 520;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
    camera.position.set(-4.6, 0.65, 8.2);
    camera.lookAt(new THREE.Vector3(0.25, -0.15, -1.1));

    renderer = new THREE.WebGLRenderer({
      canvas: state.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;

    var envMap = createStudioEnvMap();
    scene.environment = envMap;

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));

    var keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(6, 7, 6);
    scene.add(keyLight);

    var rimLight = new THREE.DirectionalLight(0xdbeafe, 2.4);
    rimLight.position.set(-7, 5, -5);
    scene.add(rimLight);

    var fillLight = new THREE.DirectionalLight(0xf1f5f9, 1.2);
    fillLight.position.set(0, -6, 5);
    scene.add(fillLight);

    // Contact shadow
    var shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    var sCtx = shadowCanvas.getContext('2d');
    var sGrad = sCtx.createRadialGradient(128, 128, 10, 128, 128, 120);
    sGrad.addColorStop(0, 'rgba(8, 12, 20, 0.34)');
    sGrad.addColorStop(0.5, 'rgba(8, 12, 20, 0.11)');
    sGrad.addColorStop(1, 'rgba(8, 12, 20, 0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 256, 256);
    var shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(7.5, 7.5),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, -3.35, -1.4);
    scene.add(shadowPlane);

    initWatchFaceCanvas();
    buildSmartwatch(envMap);

    state.canvas.addEventListener('pointerdown', onPointerDown);
    state.canvas.addEventListener('pointermove', onPointerMove);
    state.canvas.addEventListener('pointerup', onPointerUp);
    state.canvas.addEventListener('pointercancel', onPointerUp);
    state.canvas.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('visibilitychange', onVisibility);

    if (window.ResizeObserver) {
      state.ro = new ResizeObserver(resize);
      state.ro.observe(host);
    } else {
      window.addEventListener('resize', resize);
    }

    resize();
    start();
    return api;
  }

  function dispose() {
    stop();
    state.mounted = false;
    document.removeEventListener('visibilitychange', onVisibility);
    if (state.ro) state.ro.disconnect();
    if (state.canvas && state.canvas.parentNode) state.canvas.parentNode.removeChild(state.canvas);
    if (renderer) { renderer.dispose(); renderer = null; }
    scene = null;
    camera = null;
    watchGroup = null;
    state.host = null;
    state.canvas = null;
  }

  var api = {
    mount: mount,
    dispose: dispose,
    resize: resize,
    pulse: function (ms) { state.sensorUntil = performance.now() + (ms || 2400); },
    spin: function () { targetCrownRotation += Math.PI * 1.5; crownWeight = 1.24; },
    rumble: function (v) { rumbleIntensity = v == null ? 0.9 : v; },
    setTheme: function (i) {
      currentThemeIndex = (i | 0) % dialThemes.length;
      updateWatchFaceCanvas();
      state.lastSecond = -1;
    },
    setView: function (name) {
      var v = VIEWS[name];
      if (!v) return;
      state.autoYaw = false;
      state.targetYaw = v.yaw;
      state.targetPitch = v.pitch;
    },
    setLive: function (on) {
      clockMode = on ? 'live' : 'reference';
      updateWatchFaceCanvas();
      state.lastSecond = -1;
    },
    isMounted: function () { return state.mounted; }
  };

  window.WristWatch3D = api;
})();
`;

fs.writeFileSync('assets/watch3d.js', header + body + footer);
console.log('wrote assets/watch3d.js', (header + body + footer).split('\n').length, 'lines');
