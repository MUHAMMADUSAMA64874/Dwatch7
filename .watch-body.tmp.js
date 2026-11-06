// 1. Procedural Studio Softbox Environment Map
function createStudioEnvMap() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');

  const bgGrad = ctx.createLinearGradient(0, 0, 0, 512);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.5, '#1e293b');
  bgGrad.addColorStop(1, '#090d16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 512);

  const drawSoftbox = (x, y, w, h, intensity) => {
    ctx.save();
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 5, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
    g.addColorStop(0.4, `rgba(226, 232, 240, ${intensity * 0.6})`);
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  };

  drawSoftbox(100, 40, 320, 140, 0.95);
  drawSoftbox(550, 60, 280, 180, 0.85);
  drawSoftbox(240, 260, 500, 90, 0.65);
  drawSoftbox(780, 180, 200, 260, 0.9);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(140, 95, 260, 16);
  ctx.fillRect(620, 120, 220, 14);
  ctx.fillRect(50, 210, 920, 8);

  const envTex = new THREE.CanvasTexture(c);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.encoding = THREE.sRGBEncoding;
  return envTex;
}

// 2. Dynamic Contour OLED Watch Face Canvas
function initWatchFaceCanvas() {
  screenCanvas = document.createElement('canvas');
  screenCanvas.width = 1024;
  screenCanvas.height = 1240;
  screenCtx = screenCanvas.getContext('2d');

  screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.anisotropy = 16;
  screenTexture.encoding = THREE.sRGBEncoding;
  updateWatchFaceCanvas();
}

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawContourNumerals(ctx, W, H, theme, pulseScale) {
  ctx.save();
  const grad = ctx.createLinearGradient(80, 80, W - 80, H - 80);
  grad.addColorStop(0, theme.top);
  grad.addColorStop(0.52, theme.mid);
  grad.addColorStop(1, theme.bottom);

  ctx.strokeStyle = grad;
  ctx.fillStyle = grad;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const baseStroke = 25 * pulseScale;

  const drawGlyph = (fn) => {
    ctx.save();
    ctx.lineWidth = baseStroke;
    fn(ctx);
    ctx.restore();
  };

  // 12
  drawGlyph((c) => {
    c.beginPath(); c.moveTo(395, 108); c.lineTo(428, 72); c.lineTo(428, 198); c.stroke();
    c.beginPath(); c.moveTo(468, 98); c.bezierCurveTo(468, 62, 608, 62, 608, 106);
    c.bezierCurveTo(608, 142, 472, 146, 470, 196); c.lineTo(615, 196); c.stroke();
  });
  // 1
  drawGlyph((c) => { c.beginPath(); c.moveTo(695, 86); c.quadraticCurveTo(845, 92, 898, 185); c.stroke(); });
  // 2
  drawGlyph((c) => {
    c.beginPath(); c.moveTo(892, 240); c.bezierCurveTo(958, 225, 962, 310, 925, 345);
    c.bezierCurveTo(892, 375, 885, 425, 948, 435); c.stroke();
  });
  // 3
  drawGlyph((c) => {
    c.beginPath(); c.moveTo(895, 495); c.bezierCurveTo(962, 490, 962, 595, 905, 610);
    c.bezierCurveTo(962, 625, 962, 735, 892, 728); c.stroke();
  });
  // 4
  drawGlyph((c) => {
    c.beginPath(); c.moveTo(942, 790); c.lineTo(882, 895); c.lineTo(958, 895);
    c.moveTo(938, 835); c.lineTo(938, 955); c.stroke();
  });
  // 5
  drawGlyph((c) => {
    c.beginPath(); c.moveTo(920, 1015); c.lineTo(845, 1045);
    c.quadraticCurveTo(915, 1085, 835, 1142); c.quadraticCurveTo(765, 1175, 705, 1145); c.stroke();
  });
  // 6
  drawGlyph((c) => {
    c.beginPath(); c.moveTo(605, 1090); c.bezierCurveTo(540, 1085, 415, 1110, 418, 1152);
    c.bezierCurveTo(422, 1185, 612, 1185, 612, 1148); c.bezierCurveTo(612, 1115, 485, 1118, 440, 1142); c.stroke();
  });
  // 7
  drawGlyph((c) => { c.beginPath(); c.moveTo(118, 1045); c.quadraticCurveTo(185, 1145, 315, 1162); c.lineTo(245, 1070); c.stroke(); });
  // 8
  drawGlyph((c) => {
    c.lineWidth = baseStroke * 0.92;
    c.beginPath(); c.ellipse(112, 845, 36, 52, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(115, 952, 42, 56, 0, 0, Math.PI * 2); c.stroke();
  });
  // 9
  drawGlyph((c) => {
    c.beginPath(); c.ellipse(114, 568, 42, 64, 0, 0, Math.PI * 2);
    c.moveTo(154, 568); c.bezierCurveTo(156, 675, 135, 735, 82, 735); c.stroke();
  });
  // 10
  drawGlyph((c) => {
    c.lineWidth = baseStroke * 1.15;
    c.beginPath(); c.moveTo(92, 455); c.bezierCurveTo(92, 310, 115, 225, 175, 165); c.stroke();
    c.lineWidth = baseStroke * 0.95;
    c.beginPath(); c.moveTo(162, 275); c.bezierCurveTo(148, 275, 142, 455, 178, 455);
    c.bezierCurveTo(212, 455, 215, 275, 162, 275); c.stroke();
  });
  // 11
  drawGlyph((c) => {
    c.lineWidth = baseStroke * 1.2;
    c.beginPath(); c.moveTo(155, 195); c.quadraticCurveTo(205, 112, 338, 92); c.stroke();
    c.lineWidth = baseStroke * 1.05;
    c.beginPath(); c.moveTo(195, 232); c.quadraticCurveTo(242, 156, 348, 138); c.stroke();
  });

  ctx.restore();
}

function updateWatchFaceCanvas() {
  if (!screenCtx) return;
  const W = screenCanvas.width;
  const H = screenCanvas.height;
  const cx = W / 2;
  const cy = H / 2;

  screenCtx.fillStyle = '#000000';
  screenCtx.fillRect(0, 0, W, H);

  const borderGrad = screenCtx.createRadialGradient(cx, cy, W * 0.35, cx, cy, W * 0.65);
  borderGrad.addColorStop(0, 'rgba(0,0,0,0)');
  borderGrad.addColorStop(1, 'rgba(30, 41, 59, 0.22)');
  screenCtx.fillStyle = borderGrad;
  screenCtx.fillRect(0, 0, W, H);

  const theme = dialThemes[currentThemeIndex];
  drawContourNumerals(screenCtx, W, H, theme, crownWeight);

  let hours, minutes, seconds, dateLabel;
  if (clockMode === 'reference') {
    hours = 10 + 8 / 60;
    minutes = 8.2;
    seconds = 30;
    dateLabel = 'MON 25';
  } else {
    const now = new Date();
    const ms = now.getMilliseconds();
    seconds = now.getSeconds() + ms / 1000;
    minutes = now.getMinutes() + seconds / 60;
    hours = (now.getHours() % 12) + minutes / 60;
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    dateLabel = `${days[now.getDay()]} ${now.getDate()}`;
  }

  screenCtx.save();
  screenCtx.fillStyle = '#f1f5f9';
  screenCtx.font = '600 62px system-ui, -apple-system, sans-serif';
  screenCtx.textAlign = 'center';
  screenCtx.textBaseline = 'middle';
  screenCtx.fillText(dateLabel, cx, cy - 205);
  screenCtx.restore();

  const hourAngle = (hours / 12) * Math.PI * 2;
  const minAngle = (minutes / 60) * Math.PI * 2;
  const secAngle = (seconds / 60) * Math.PI * 2;

  const drawHand = (angle, length, width, tailLength) => {
    screenCtx.save();
    screenCtx.translate(cx, cy);
    screenCtx.rotate(angle);
    screenCtx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    screenCtx.shadowBlur = 18;
    screenCtx.shadowOffsetX = 4;
    screenCtx.shadowOffsetY = 6;
    screenCtx.strokeStyle = '#ffffff';
    screenCtx.lineWidth = width * 0.42;
    screenCtx.lineCap = 'round';
    screenCtx.beginPath();
    screenCtx.moveTo(0, tailLength);
    screenCtx.lineTo(0, -55);
    screenCtx.stroke();
    screenCtx.fillStyle = '#ffffff';
    drawRoundedRectPath(screenCtx, -width / 2, -length, width, length - 38, width / 2);
    screenCtx.fill();
    screenCtx.restore();
  };

  drawHand(hourAngle, 245, 34, 0);
  drawHand(minAngle, 375, 30, 0);

  // Red Second Hand
  screenCtx.save();
  screenCtx.translate(cx, cy);
  screenCtx.rotate(secAngle);
  screenCtx.strokeStyle = '#ef4444';
  screenCtx.lineWidth = 7;
  screenCtx.lineCap = 'round';
  screenCtx.beginPath();
  screenCtx.moveTo(0, 95);
  screenCtx.lineTo(0, -430);
  screenCtx.stroke();

  screenCtx.beginPath();
  screenCtx.arc(0, 0, 22, 0, Math.PI * 2);
  screenCtx.fillStyle = '#ffffff';
  screenCtx.fill();

  screenCtx.beginPath();
  screenCtx.arc(0, 0, 12, 0, Math.PI * 2);
  screenCtx.fillStyle = '#ef4444';
  screenCtx.fill();

  screenCtx.beginPath();
  screenCtx.arc(0, 0, 5, 0, Math.PI * 2);
  screenCtx.fillStyle = '#111827';
  screenCtx.fill();
  screenCtx.restore();

  screenTexture.needsUpdate = true;
}

// Backward-compatibility alias
function renderContourDial() {
  updateWatchFaceCanvas();
}

// 3. 3D Procedural Geometry Builders
function createRoundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function createCurvedPillowGeometry(width, height, depth, cornerRadius, bevelRadius, isScreenDomed = false) {
  const shape = createRoundedRectShape(width - bevelRadius * 2, height - bevelRadius * 2, cornerRadius - bevelRadius);
  const extrudeSettings = {
    depth: depth,
    bevelEnabled: true,
    bevelSegments: 20,
    steps: 2,
    bevelSize: bevelRadius,
    bevelThickness: bevelRadius,
    curveSegments: 36
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();

  const pos = geo.attributes.position;
  const uvs = geo.attributes.uv;
  const totalW = width;
  const totalH = height;

  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);

    if (isScreenDomed && vz > 0) {
      const nx = vx / (totalW * 0.5);
      const ny = vy / (totalH * 0.5);
      const r2 = Math.min(1.0, nx * nx + ny * ny);
      vz += (1.0 - r2) * 0.065;
      pos.setZ(i, vz);
    }

    const u = (vx / totalW) + 0.5;
    const v = (vy / totalH) + 0.5;
    uvs.setXY(i, u, v);
  }

  geo.computeVertexNormals();
  return geo;
}

function createProceduralStrapMesh(curvePoints, numSteps, widthFunc, thickness, material) {
  const curve = new THREE.CatmullRomCurve3(curvePoints);
  const frames = curve.computeFrenetFrames(numSteps, false);
  const crossSegments = 28;

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const p = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const curWidth = widthFunc(t);

    for (let j = 0; j <= crossSegments; j++) {
      const u = (j / crossSegments) * 2 - 1;
      const xOffset = u * (curWidth / 2);
      const yOffset = -Math.pow(u, 4) * (thickness * 0.38);

      const vx = p.x + B.x * xOffset + N.x * yOffset;
      const vy = p.y + B.y * xOffset + N.y * yOffset;
      const vz = p.z + B.z * xOffset + N.z * yOffset;

      positions.push(vx, vy, vz);
      normals.push(N.x, N.y, N.z);
      uvs.push(j / crossSegments, t * 5);
    }
  }

  for (let i = 0; i < numSteps; i++) {
    for (let j = 0; j < crossSegments; j++) {
      const a = i * (crossSegments + 1) + j;
      const b = (i + 1) * (crossSegments + 1) + j;
      const c = (i + 1) * (crossSegments + 1) + (j + 1);
      const d = i * (crossSegments + 1) + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return new THREE.Mesh(geo, material);
}

function buildSportBand(parentGroup, strapMaterial, silverMetalMaterial) {
  const bandGroup = new THREE.Group();

  const topStrapPoints = [
    new THREE.Vector3(0, 1.82, -0.06),
    new THREE.Vector3(0, 2.35, -0.32),
    new THREE.Vector3(0, 2.55, -1.35),
    new THREE.Vector3(0, 2.15, -2.65),
    new THREE.Vector3(0, 1.15, -3.55),
    new THREE.Vector3(0, -0.10, -3.72),
    new THREE.Vector3(0, -1.18, -3.28),
    new THREE.Vector3(0, -1.65, -2.75)
  ];

  const topWidthProfile = (t) => {
    if (t < 0.18) {
      const k = t / 0.18;
      return 2.56 * (1 - k) + 1.92 * k;
    }
    const slotFlare = Math.exp(-Math.pow((t - 0.62) / 0.14, 2)) * 0.28;
    const tipTaper = t > 0.88 ? Math.cos(((t - 0.88) / 0.12) * (Math.PI / 2)) * 0.35 : 0;
    return 1.90 + slotFlare - tipTaper;
  };

  const topStrapMesh = createProceduralStrapMesh(topStrapPoints, 90, topWidthProfile, 0.21, strapMaterial);
  bandGroup.add(topStrapMesh);

  const bottomStrapPoints = [
    new THREE.Vector3(0, -1.82, -0.06),
    new THREE.Vector3(0, -2.38, -0.38),
    new THREE.Vector3(0, -2.68, -1.45),
    new THREE.Vector3(0, -2.25, -2.58),
    new THREE.Vector3(0, -1.35, -3.15),
    new THREE.Vector3(0, -0.20, -3.45),
    new THREE.Vector3(0, 0.88, -3.12),
    new THREE.Vector3(0, 1.55, -2.35)
  ];

  const bottomWidthProfile = (t) => {
    if (t < 0.18) {
      const k = t / 0.18;
      return 2.56 * (1 - k) + 1.86 * k;
    }
    const tipTaper = t > 0.88 ? ((t - 0.88) / 0.12) * 0.35 : 0;
    return 1.84 - tipTaper;
  };

  const bottomStrapMesh = createProceduralStrapMesh(bottomStrapPoints, 90, bottomWidthProfile, 0.20, strapMaterial);
  bandGroup.add(bottomStrapMesh);

  // Silver Pin Clasp
  const pinDiscGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 48);
  pinDiscGeo.rotateX(Math.PI / 2);
  const pinDiscMesh = new THREE.Mesh(pinDiscGeo, silverMetalMaterial);
  pinDiscMesh.position.set(0, -0.92, -3.18);
  pinDiscMesh.rotation.x = -0.58;
  bandGroup.add(pinDiscMesh);

  const pinStemGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.32, 24);
  pinStemGeo.rotateX(Math.PI / 2);
  const pinStem = new THREE.Mesh(pinStemGeo, silverMetalMaterial);
  pinStem.position.set(0, -1.02, -3.30);
  pinStem.rotation.x = -0.58;
  bandGroup.add(pinStem);

  // Sizing holes
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.9, metalness: 0.0 });
  const bottomCurve = new THREE.CatmullRomCurve3(bottomStrapPoints);
  const holePositions = [0.26, 0.33, 0.40, 0.47, 0.54];
  holePositions.forEach((tPos) => {
    const pt = bottomCurve.getPointAt(tPos);
    const tan = bottomCurve.getTangentAt(tPos);
    const holeGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.23, 20);
    const holeMesh = new THREE.Mesh(holeGeo, holeMat);
    holeMesh.position.copy(pt);
    holeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -tan.z, tan.y).normalize());
    bandGroup.add(holeMesh);
  });

  // Tuck slot collar
  const slotCollarGeo = new THREE.BoxGeometry(2.12, 0.18, 0.34);
  const slotCollar = new THREE.Mesh(slotCollarGeo, strapMaterial);
  slotCollar.position.set(0, -0.15, -3.56);
  slotCollar.rotation.x = 0.15;
  bandGroup.add(slotCollar);

  parentGroup.add(bandGroup);
}

// 4. Build Complete Smartwatch Assembly
function buildSmartwatch(envMap) {
  watchGroup = new THREE.Group();

  const caseMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e2229,
    metalness: 0.88,
    roughness: 0.18,
    envMap: envMap,
    envMapIntensity: 1.45
  });

  const screenMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: screenTexture,
    emissiveIntensity: 1.05,
    roughness: 0.06,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 0.9,
    envMap: envMap,
    envMapIntensity: 0.55
  });

  const strapMaterial = new THREE.MeshStandardMaterial({
    color: 0x121316,
    metalness: 0.08,
    roughness: 0.68,
    envMap: envMap,
    envMapIntensity: 0.45
  });

  const silverMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.18,
    envMap: envMap,
    envMapIntensity: 1.3
  });

  const redAccentMaterial = new THREE.MeshStandardMaterial({
    color: 0xef233c,
    emissive: 0x450a0a,
    metalness: 0.35,
    roughness: 0.25,
    envMap: envMap
  });

  // 1. Pebble Case Body
  const caseW = 3.25;
  const caseH = 3.92;
  const caseGeo = createCurvedPillowGeometry(caseW, caseH, 0.42, 0.78, 0.28, false);
  const caseMesh = new THREE.Mesh(caseGeo, caseMaterial);
  watchGroup.add(caseMesh);

  // 2. Rear Ceramic Dome Pod
  const backCrystalGeo = new THREE.CylinderGeometry(1.18, 1.08, 0.16, 48);
  backCrystalGeo.rotateX(Math.PI / 2);
  const backCrystalMat = new THREE.MeshPhysicalMaterial({
    color: 0x07090e,
    roughness: 0.12,
    metalness: 0.5,
    clearcoat: 1.0,
    envMap: envMap
  });
  const backCrystal = new THREE.Mesh(backCrystalGeo, backCrystalMat);
  backCrystal.position.z = -0.44;
  watchGroup.add(backCrystal);

  // 3. Photo-Matched Dual Green Slit Optical LEDs (--  --)
  const slitWidth = 0.36;
  const slitHeight = 0.085;
  const slitDepth = 0.035;
  const slitGeo = new THREE.BoxGeometry(slitWidth, slitHeight, slitDepth);

  rearLedMat = new THREE.MeshStandardMaterial({
    color: 0x003314,
    emissive: 0x001a08,
    emissiveIntensity: 0.08,
    roughness: 0.1,
    metalness: 0.1
  });

  rearLedMesh1 = new THREE.Mesh(slitGeo, rearLedMat);
  rearLedMesh1.position.set(-0.27, 0.26, -0.535);
  watchGroup.add(rearLedMesh1);

  rearLedMesh2 = new THREE.Mesh(slitGeo, rearLedMat);
  rearLedMesh2.position.set(0.27, 0.26, -0.535);
  watchGroup.add(rearLedMesh2);

  const haloGeo = new THREE.PlaneGeometry(0.48, 0.18);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x00ff66,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  slitHaloMesh1 = new THREE.Mesh(haloGeo, haloMat.clone());
  slitHaloMesh1.position.set(-0.27, 0.26, -0.54);
  slitHaloMesh1.rotation.y = Math.PI;
  watchGroup.add(slitHaloMesh1);

  slitHaloMesh2 = new THREE.Mesh(haloGeo, haloMat.clone());
  slitHaloMesh2.position.set(0.27, 0.26, -0.54);
  slitHaloMesh2.rotation.y = Math.PI;
  watchGroup.add(slitHaloMesh2);

  // Dynamic optical point light
  sensorPointLight = new THREE.PointLight(0x00ff66, 0.0, 5.0, 1.8);
  sensorPointLight.position.set(0, 0.26, -0.85);
  watchGroup.add(sensorPointLight);

  // 4. Curved Edge-to-Edge Screen
  const screenW = 3.04;
  const screenH = 3.70;
  const screenGeo = createCurvedPillowGeometry(screenW, screenH, 0.12, 0.70, 0.14, true);
  const sPos = screenGeo.attributes.position;
  const sUv = screenGeo.attributes.uv;
  for (let i = 0; i < sPos.count; i++) {
    if (sPos.getZ(i) < -0.02) {
      sUv.setXY(i, 0.01, 0.01);
    }
  }
  const screenMesh = new THREE.Mesh(screenGeo, screenMaterial);
  screenMesh.position.z = 0.34;
  watchGroup.add(screenMesh);

  // 5. Digital Crown with Knurls and Signature RED ACCENT RING
  crownGroup = new THREE.Group();
  crownGroup.position.set(caseW / 2 + 0.06, 0.78, 0.04);

  const stemGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.26, 32);
  stemGeo.rotateZ(Math.PI / 2);
  const stemMesh = new THREE.Mesh(stemGeo, caseMaterial);
  stemMesh.position.x = -0.08;
  crownGroup.add(stemMesh);

  const crownRadius = 0.42;
  const crownThickness = 0.28;
  const barrelGeo = new THREE.CylinderGeometry(crownRadius, crownRadius, crownThickness, 48);
  barrelGeo.rotateZ(Math.PI / 2);
  const barrelMesh = new THREE.Mesh(barrelGeo, caseMaterial);
  crownGroup.add(barrelMesh);

  const numRidges = 36;
  const ridgeGeo = new THREE.BoxGeometry(crownThickness * 0.88, 0.028, 0.038);
  for (let i = 0; i < numRidges; i++) {
    const angle = (i / numRidges) * Math.PI * 2;
    const ridge = new THREE.Mesh(ridgeGeo, silverMetalMaterial);
    ridge.position.set(0, Math.cos(angle) * (crownRadius + 0.006), Math.sin(angle) * (crownRadius + 0.006));
    ridge.rotation.x = -angle;
    crownGroup.add(ridge);
  }

  const outerRimGeo = new THREE.TorusGeometry(crownRadius - 0.03, 0.04, 20, 48);
  outerRimGeo.rotateY(Math.PI / 2);
  const outerRim = new THREE.Mesh(outerRimGeo, caseMaterial);
  outerRim.position.x = crownThickness / 2;
  crownGroup.add(outerRim);

  const redRingGeo = new THREE.TorusGeometry(crownRadius - 0.065, 0.026, 20, 48);
  redRingGeo.rotateY(Math.PI / 2);
  const redRing = new THREE.Mesh(redRingGeo, redAccentMaterial);
  redRing.position.x = crownThickness / 2 + 0.022;
  crownGroup.add(redRing);

  const silverCapGeo = new THREE.CylinderGeometry(crownRadius - 0.085, crownRadius - 0.085, 0.04, 48);
  silverCapGeo.rotateZ(Math.PI / 2);
  const silverCapMesh = new THREE.Mesh(silverCapGeo, silverMetalMaterial);
  silverCapMesh.position.x = crownThickness / 2 + 0.018;
  crownGroup.add(silverCapMesh);

  watchGroup.add(crownGroup);

  // Microphone pinhole
  const micHoleGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.12, 24);
  micHoleGeo.rotateZ(Math.PI / 2);
  const micHoleMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const micHole = new THREE.Mesh(micHoleGeo, micHoleMat);
  micHole.position.set(caseW / 2 + 0.01, 0.16, 0.0);
  watchGroup.add(micHole);

  // Flush side button
  const btnShape = createRoundedRectShape(0.22, 1.08, 0.11);
  const btnExtrude = new THREE.ExtrudeGeometry(btnShape, {
    depth: 0.12, bevelEnabled: true, bevelSegments: 8, steps: 1, bevelSize: 0.025, bevelThickness: 0.025
  });
  btnExtrude.center();
  btnExtrude.rotateY(Math.PI / 2);

  const recessShape = createRoundedRectShape(0.26, 1.13, 0.13);
  const recessGeo = new THREE.ExtrudeGeometry(recessShape, { depth: 0.04, bevelEnabled: false });
  recessGeo.center();
  recessGeo.rotateY(Math.PI / 2);
  const recessMesh = new THREE.Mesh(recessGeo, micHoleMat);
  recessMesh.position.set(caseW / 2 - 0.005, -0.58, -0.02);
  watchGroup.add(recessMesh);

  sideButtonMesh = new THREE.Mesh(btnExtrude, caseMaterial.clone());
  sideButtonMesh.material.color.setHex(0x2a2f3a);
  sideButtonMesh.position.set(caseW / 2 + 0.015, -0.58, -0.02);
  watchGroup.add(sideButtonMesh);

  // 6. Sculpted Curved Sport Band
  buildSportBand(watchGroup, strapMaterial, silverMetalMaterial);

  // Initial Hero Pose matching reference photo
  watchGroup.rotation.y = -0.52;
  watchGroup.rotation.x = 0.08;
  watchGroup.rotation.z = -0.04;

  scene.add(watchGroup);
}