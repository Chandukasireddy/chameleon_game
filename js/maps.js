// ═══════════════════════════════════════════════
// 🗺️ MAPS — 5 Themed 3D Environments
// ═══════════════════════════════════════════════

import * as THREE from 'three';

// ─── Shared helpers ───

function box(w, h, d, color, x, y, z, opts = {}) {
  const geom = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.8,
    metalness: opts.metalness ?? 0.05,
    ...(opts.emissive ? { emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity || 1 } : {}),
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (opts.rotY) mesh.rotation.y = opts.rotY;
  if (opts.rotX) mesh.rotation.x = opts.rotX;
  return mesh;
}

function cylinder(rTop, rBot, h, color, x, y, z, opts = {}) {
  const geom = new THREE.CylinderGeometry(rTop, rBot, h, opts.segments || 16);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.8,
    metalness: opts.metalness ?? 0.05,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (opts.rotX) mesh.rotation.x = opts.rotX;
  if (opts.rotZ) mesh.rotation.z = opts.rotZ;
  return mesh;
}

function sphere(r, color, x, y, z, opts = {}) {
  const geom = new THREE.SphereGeometry(r, 16, 16);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.8,
    metalness: opts.metalness ?? 0.05,
    ...(opts.emissive ? { emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity || 1 } : {}),
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function plane(w, h, color, x, y, z, opts = {}) {
  const geom = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.9,
    metalness: opts.metalness ?? 0,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  if (opts.rotX !== undefined) mesh.rotation.x = opts.rotX;
  if (opts.rotY !== undefined) mesh.rotation.y = opts.rotY;
  return mesh;
}

function pointLight(color, intensity, x, y, z, distance = 15) {
  const light = new THREE.PointLight(color, intensity, distance);
  light.position.set(x, y, z);
  light.castShadow = false;
  return light;
}

// ═══════════════ MAP DEFINITIONS ═══════════════

export const MAP_DATA = {
  backrooms: {
    name: 'Backrooms',
    icon: '🏚️',
    description: 'Endless yellow hallways',
    bgColor: '#2a2200',
    fogColor: 0x2a2200,
    fogDensity: 0.03,
    build: buildBackrooms,
  },
  garden: {
    name: 'Garden',
    icon: '🌿',
    description: 'Lush outdoor greenery',
    bgColor: '#0a1a0a',
    fogColor: 0x0a1a0a,
    fogDensity: 0.012,
    build: buildGarden,
  },
  office: {
    name: 'Office',
    icon: '🏢',
    description: 'Corporate workspace',
    bgColor: '#0a0a14',
    fogColor: 0x0a0a14,
    fogDensity: 0.02,
    build: buildOffice,
  },
  gallery: {
    name: 'Gallery',
    icon: '🎨',
    description: 'Modern art museum',
    bgColor: '#121215',
    fogColor: 0x121215,
    fogDensity: 0.01,
    build: buildGallery,
  },
  sewer: {
    name: 'Sewer',
    icon: '🧱',
    description: 'Dark underground tunnels',
    bgColor: '#050808',
    fogColor: 0x050808,
    fogDensity: 0.04,
    build: buildSewer,
  },
};

/** Load a map into the scene. Returns { objects, bounds, seekerSpawn, hiderSpawn } */
export function loadMap(mapName, scene) {
  const data = MAP_DATA[mapName];
  if (!data) throw new Error(`Unknown map: ${mapName}`);
  return data.build(scene);
}

// ═══════════════ MAP 1: BACKROOMS ═══════════════

function buildBackrooms(scene) {
  const objects = [];
  const W = 24, D = 24, H = 3.5;

  // Lighting
  const ambient = new THREE.AmbientLight(0xccaa44, 0.4);
  scene.add(ambient);
  objects.push(ambient);

  // Floor
  const floor = plane(W, D, 0x8B7355, 0, 0, 0, { rotX: -Math.PI / 2 });
  scene.add(floor);
  objects.push(floor);

  // Ceiling
  const ceiling = plane(W, D, 0xccbb77, 0, H, 0, { rotX: Math.PI / 2 });
  scene.add(ceiling);
  objects.push(ceiling);

  // Walls
  const wallColor = 0xccbb55;
  const walls = [
    box(W, H, 0.2, wallColor, 0, H/2, -D/2),    // back
    box(W, H, 0.2, wallColor, 0, H/2, D/2),     // front
    box(0.2, H, D, wallColor, -W/2, H/2, 0),    // left
    box(0.2, H, D, wallColor, W/2, H/2, 0),     // right
  ];
  walls.forEach(w => { scene.add(w); objects.push(w); });

  // Interior walls (create rooms/corridors)
  const innerWalls = [
    box(0.15, H, 8, wallColor, -4, H/2, -4),
    box(8, H, 0.15, wallColor, 0, H/2, -2),
    box(0.15, H, 6, wallColor, 6, H/2, 3),
    box(6, H, 0.15, wallColor, -6, H/2, 5),
    box(0.15, H, 10, wallColor, 3, H/2, 6),
    box(5, H, 0.15, wallColor, 8, H/2, -4),
  ];
  innerWalls.forEach(w => { scene.add(w); objects.push(w); });

  // Pillars
  for (let i = 0; i < 6; i++) {
    const px = (Math.random() - 0.5) * (W - 4);
    const pz = (Math.random() - 0.5) * (D - 4);
    const pillar = box(0.6, H, 0.6, 0xbbaa44, px, H/2, pz);
    scene.add(pillar);
    objects.push(pillar);
  }

  // Fluorescent lights on ceiling
  for (let x = -8; x <= 8; x += 4) {
    for (let z = -8; z <= 8; z += 6) {
      const light = box(1.5, 0.08, 0.3, 0xffffee, x, H - 0.05, z, {
        emissive: 0xffffcc, emissiveIntensity: 2, roughness: 0.2,
      });
      scene.add(light);
      objects.push(light);

      const pl = pointLight(0xffffaa, 1.5, x, H - 0.3, z, 8);
      scene.add(pl);
      objects.push(pl);
    }
  }

  // Scattered furniture
  const furniture = [
    box(1.2, 0.8, 0.8, 0x665533, -8, 0.4, -8),
    box(0.8, 0.5, 1.0, 0x776644, 5, 0.25, -7),
    box(2.0, 0.4, 1.0, 0x887755, -2, 0.2, 8),
    box(0.5, 1.0, 0.5, 0x665533, 9, 0.5, 5),
    box(1.5, 0.6, 0.6, 0x776644, -9, 0.3, 3),
  ];
  furniture.forEach(f => { scene.add(f); objects.push(f); });

  return {
    objects,
    bounds: { minX: -W/2 + 1, maxX: W/2 - 1, minZ: -D/2 + 1, maxZ: D/2 - 1 },
    seekerSpawn: new THREE.Vector3(-10, 1.7, -10),
    hiderSpawn: new THREE.Vector3(5, 0.75, 5),
  };
}

// ═══════════════ MAP 2: GARDEN ═══════════════

function buildGarden(scene) {
  const objects = [];
  const W = 30, D = 30;

  // Sky lighting
  const ambient = new THREE.AmbientLight(0x88aaff, 0.6);
  scene.add(ambient);
  objects.push(ambient);

  const sun = new THREE.DirectionalLight(0xffffcc, 1.2);
  sun.position.set(10, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  scene.add(sun);
  objects.push(sun);

  // Ground (grass)
  const ground = plane(W, D, 0x3a7d32, 0, 0, 0, { rotX: -Math.PI / 2 });
  scene.add(ground);
  objects.push(ground);

  // Stone path
  for (let z = -12; z <= 12; z += 1.5) {
    const stone = box(1.0, 0.05, 0.8, 0x888888, 0, 0.025, z, { roughness: 0.95 });
    scene.add(stone);
    objects.push(stone);
  }

  // Fence around perimeter
  const fenceColor = 0x8B6914;
  for (let i = -14; i <= 14; i += 2) {
    // Post
    const posts = [
      cylinder(0.08, 0.08, 1.2, fenceColor, i, 0.6, -D/2 + 0.5, { segments: 6 }),
      cylinder(0.08, 0.08, 1.2, fenceColor, i, 0.6, D/2 - 0.5, { segments: 6 }),
      cylinder(0.08, 0.08, 1.2, fenceColor, -W/2 + 0.5, 0.6, i, { segments: 6 }),
      cylinder(0.08, 0.08, 1.2, fenceColor, W/2 - 0.5, 0.6, i, { segments: 6 }),
    ];
    posts.forEach(p => { scene.add(p); objects.push(p); });
  }
  // Fence rails
  const rails = [
    box(W - 1, 0.08, 0.06, fenceColor, 0, 0.9, -D/2 + 0.5),
    box(W - 1, 0.08, 0.06, fenceColor, 0, 0.4, -D/2 + 0.5),
    box(W - 1, 0.08, 0.06, fenceColor, 0, 0.9, D/2 - 0.5),
    box(W - 1, 0.08, 0.06, fenceColor, 0, 0.4, D/2 - 0.5),
    box(0.06, 0.08, D - 1, fenceColor, -W/2 + 0.5, 0.9, 0),
    box(0.06, 0.08, D - 1, fenceColor, -W/2 + 0.5, 0.4, 0),
    box(0.06, 0.08, D - 1, fenceColor, W/2 - 0.5, 0.9, 0),
    box(0.06, 0.08, D - 1, fenceColor, W/2 - 0.5, 0.4, 0),
  ];
  rails.forEach(r => { scene.add(r); objects.push(r); });

  // Trees
  const treePositions = [
    [-8, -8], [8, -6], [-10, 6], [10, 8], [-3, -10], [5, 10],
    [-12, 0], [12, 3], [0, -13], [-6, 12],
  ];
  treePositions.forEach(([tx, tz]) => {
    // Trunk
    const trunk = cylinder(0.2, 0.25, 2.5, 0x6B4226, tx, 1.25, tz, { segments: 8 });
    scene.add(trunk); objects.push(trunk);
    // Foliage layers
    const foliageColors = [0x2d8a2d, 0x35a035, 0x28782a];
    foliageColors.forEach((fc, i) => {
      const r = 1.8 - i * 0.4;
      const h = 1.5 - i * 0.3;
      const foliage = sphere(r, fc, tx, 2.5 + i * 0.8, tz);
      scene.add(foliage); objects.push(foliage);
    });
  });

  // Flower beds
  const flowerColors = [0xff4488, 0xffaa00, 0xff3333, 0xaa44ff, 0xffff44, 0xff6600];
  for (let i = 0; i < 25; i++) {
    const fx = (Math.random() - 0.5) * 20;
    const fz = (Math.random() - 0.5) * 20;
    if (Math.abs(fx) < 1.5) continue; // Avoid path
    const fc = flowerColors[Math.floor(Math.random() * flowerColors.length)];
    const flower = sphere(0.12, fc, fx, 0.15, fz);
    scene.add(flower); objects.push(flower);
    // Stem
    const stem = cylinder(0.02, 0.02, 0.2, 0x2d6b2d, fx, 0.1, fz);
    scene.add(stem); objects.push(stem);
  }

  // Bushes
  const bushPositions = [[-5, -5], [7, -3], [-3, 7], [9, 9], [-11, -3], [4, -9]];
  bushPositions.forEach(([bx, bz]) => {
    for (let j = 0; j < 3; j++) {
      const bush = sphere(
        0.4 + Math.random() * 0.3,
        [0x2a7a2a, 0x338833, 0x226622][j],
        bx + (Math.random() - 0.5) * 0.8,
        0.3 + Math.random() * 0.2,
        bz + (Math.random() - 0.5) * 0.8
      );
      scene.add(bush); objects.push(bush);
    }
  });

  // Pond
  const pond = plane(3, 3, 0x1a6699, 6, 0.02, -2, { rotX: -Math.PI / 2, roughness: 0.1, metalness: 0.3 });
  scene.add(pond); objects.push(pond);

  // Garden bench
  const benchSeat = box(2, 0.1, 0.6, 0x6B4226, -6, 0.5, 2);
  scene.add(benchSeat); objects.push(benchSeat);
  const benchBack = box(2, 0.6, 0.1, 0x6B4226, -6, 0.8, 1.7);
  scene.add(benchBack); objects.push(benchBack);
  const benchLeg1 = box(0.1, 0.5, 0.1, 0x5a3a1a, -6.8, 0.25, 2);
  scene.add(benchLeg1); objects.push(benchLeg1);
  const benchLeg2 = box(0.1, 0.5, 0.1, 0x5a3a1a, -5.2, 0.25, 2);
  scene.add(benchLeg2); objects.push(benchLeg2);

  return {
    objects,
    bounds: { minX: -W/2 + 1, maxX: W/2 - 1, minZ: -D/2 + 1, maxZ: D/2 - 1 },
    seekerSpawn: new THREE.Vector3(-12, 1.7, -12),
    hiderSpawn: new THREE.Vector3(3, 0.75, 3),
  };
}

// ═══════════════ MAP 3: OFFICE ═══════════════

function buildOffice(scene) {
  const objects = [];
  const W = 22, D = 22, H = 3.2;

  // Lighting
  const ambient = new THREE.AmbientLight(0x8899bb, 0.5);
  scene.add(ambient); objects.push(ambient);

  // Floor
  const floor = plane(W, D, 0x4a5568, 0, 0, 0, { rotX: -Math.PI / 2 });
  scene.add(floor); objects.push(floor);

  // Ceiling
  const ceil = plane(W, D, 0xe8e8e8, 0, H, 0, { rotX: Math.PI / 2 });
  scene.add(ceil); objects.push(ceil);

  // Walls
  const wc = 0xd4d4d8;
  [
    box(W, H, 0.2, wc, 0, H/2, -D/2),
    box(W, H, 0.2, wc, 0, H/2, D/2),
    box(0.2, H, D, wc, -W/2, H/2, 0),
    box(0.2, H, D, wc, W/2, H/2, 0),
  ].forEach(w => { scene.add(w); objects.push(w); });

  // Ceiling lights
  for (let x = -6; x <= 6; x += 6) {
    for (let z = -6; z <= 6; z += 6) {
      const light = box(2, 0.06, 0.5, 0xffffff, x, H - 0.03, z, {
        emissive: 0xeeeeff, emissiveIntensity: 1.5,
      });
      scene.add(light); objects.push(light);
      const pl = pointLight(0xeeeeff, 1.2, x, H - 0.3, z, 10);
      scene.add(pl); objects.push(pl);
    }
  }

  // Desk clusters (L-shaped desks)
  const deskColor = 0x8B7355;
  const deskPositions = [
    [-6, -6], [-6, 0], [-6, 6],
    [0, -6], [0, 6],
    [6, -6], [6, 0], [6, 6],
  ];
  deskPositions.forEach(([dx, dz]) => {
    // Desk top
    const desk = box(2.2, 0.06, 1.0, deskColor, dx, 0.75, dz);
    scene.add(desk); objects.push(desk);
    // Legs
    [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(([lx, lz]) => {
      const leg = box(0.06, 0.74, 0.06, 0x555555, dx + lx, 0.37, dz + lz, { metalness: 0.3 });
      scene.add(leg); objects.push(leg);
    });
    // Monitor
    const monitor = box(0.6, 0.5, 0.04, 0x222222, dx, 1.1, dz - 0.3);
    scene.add(monitor); objects.push(monitor);
    const screen = box(0.55, 0.38, 0.01, 0x1a4477, dx, 1.12, dz - 0.32, {
      emissive: 0x1a4477, emissiveIntensity: 0.5,
    });
    scene.add(screen); objects.push(screen);
    // Keyboard
    const kb = box(0.4, 0.02, 0.15, 0x333333, dx, 0.79, dz + 0.1);
    scene.add(kb); objects.push(kb);
  });

  // Office chairs
  deskPositions.forEach(([dx, dz]) => {
    const seat = cylinder(0.3, 0.3, 0.06, 0x2a2a2a, dx, 0.45, dz + 0.6, { segments: 12 });
    scene.add(seat); objects.push(seat);
    const back = box(0.5, 0.5, 0.05, 0x2a2a2a, dx, 0.8, dz + 0.8);
    scene.add(back); objects.push(back);
    const pole = cylinder(0.04, 0.04, 0.4, 0x666666, dx, 0.22, dz + 0.6);
    scene.add(pole); objects.push(pole);
  });

  // Filing cabinets along walls
  const cabinetPositions = [
    [-9, -10], [-9, -7], [9, -10], [9, -7], [-9, 7], [9, 7],
  ];
  cabinetPositions.forEach(([cx, cz]) => {
    const cab = box(0.6, 1.4, 0.5, 0x888888, cx, 0.7, cz, { metalness: 0.2 });
    scene.add(cab); objects.push(cab);
    // Drawer handles
    for (let h = 0.3; h <= 1.1; h += 0.4) {
      const handle = box(0.2, 0.03, 0.02, 0xaaaaaa, cx, h, cz + 0.26, { metalness: 0.5 });
      scene.add(handle); objects.push(handle);
    }
  });

  // Potted plants in corners
  const plantCorners = [[-10, -10], [10, -10], [-10, 10], [10, 10]];
  plantCorners.forEach(([px, pz]) => {
    const pot = cylinder(0.3, 0.25, 0.4, 0x8B4513, px, 0.2, pz);
    scene.add(pot); objects.push(pot);
    const plant = sphere(0.5, 0x2d8a2d, px, 0.7, pz);
    scene.add(plant); objects.push(plant);
  });

  // Whiteboard on wall
  const wb = box(3, 1.5, 0.05, 0xf5f5f5, 0, 1.8, -D/2 + 0.15);
  scene.add(wb); objects.push(wb);
  const wbFrame = box(3.1, 1.6, 0.03, 0x888888, 0, 1.8, -D/2 + 0.12);
  scene.add(wbFrame); objects.push(wbFrame);

  return {
    objects,
    bounds: { minX: -W/2 + 1, maxX: W/2 - 1, minZ: -D/2 + 1, maxZ: D/2 - 1 },
    seekerSpawn: new THREE.Vector3(-8, 1.7, 8),
    hiderSpawn: new THREE.Vector3(3, 0.75, -3),
  };
}

// ═══════════════ MAP 4: ART GALLERY ═══════════════

function buildGallery(scene) {
  const objects = [];
  const W = 26, D = 26, H = 5;

  // Lighting — elegant museum lighting
  const ambient = new THREE.AmbientLight(0xcccccc, 0.3);
  scene.add(ambient); objects.push(ambient);

  // Floor (marble-like)
  const floor = plane(W, D, 0xe8e0d8, 0, 0, 0, { rotX: -Math.PI / 2, roughness: 0.3, metalness: 0.1 });
  scene.add(floor); objects.push(floor);

  // Ceiling
  const ceil = plane(W, D, 0xf5f5f5, 0, H, 0, { rotX: Math.PI / 2 });
  scene.add(ceil); objects.push(ceil);

  // Walls (white)
  const wc = 0xf0f0f0;
  [
    box(W, H, 0.2, wc, 0, H/2, -D/2),
    box(W, H, 0.2, wc, 0, H/2, D/2),
    box(0.2, H, D, wc, -W/2, H/2, 0),
    box(0.2, H, D, wc, W/2, H/2, 0),
  ].forEach(w => { scene.add(w); objects.push(w); });

  // Interior partition walls
  const partitions = [
    box(0.15, H, 8, wc, -4, H/2, -3),
    box(0.15, H, 8, wc, 4, H/2, 3),
    box(8, H, 0.15, wc, 0, H/2, -6),
  ];
  partitions.forEach(p => { scene.add(p); objects.push(p); });

  // Paintings on walls (colorful rectangles)
  const paintingColors = [0xff3366, 0x3366ff, 0xffcc00, 0x33cc66, 0xff6600, 0x9933ff, 0x00cccc, 0xff3399];
  const paintingPositions = [
    { x: -5, y: 2.5, z: -D/2 + 0.15, rotY: 0, w: 2, h: 1.5 },
    { x: 5, y: 2.5, z: -D/2 + 0.15, rotY: 0, w: 1.5, h: 2 },
    { x: -8, y: 2.5, z: -D/2 + 0.15, rotY: 0, w: 1.2, h: 1.2 },
    { x: W/2 - 0.15, y: 2.5, z: -5, rotY: Math.PI/2, w: 2, h: 1.5 },
    { x: W/2 - 0.15, y: 2.5, z: 5, rotY: Math.PI/2, w: 1.8, h: 1.3 },
    { x: -W/2 + 0.15, y: 2.5, z: -5, rotY: -Math.PI/2, w: 1.5, h: 2 },
    { x: -W/2 + 0.15, y: 2.5, z: 5, rotY: -Math.PI/2, w: 2.2, h: 1.5 },
    { x: 5, y: 2.5, z: D/2 - 0.15, rotY: Math.PI, w: 2, h: 1.8 },
  ];
  paintingPositions.forEach((p, i) => {
    // Frame
    const frame = box(p.w + 0.15, p.h + 0.15, 0.05, 0x333333, p.x, p.y, p.z, { rotY: p.rotY });
    scene.add(frame); objects.push(frame);
    // Canvas
    const painting = box(p.w, p.h, 0.04, paintingColors[i % paintingColors.length], p.x, p.y, p.z, { rotY: p.rotY });
    // Offset slightly forward
    const offset = new THREE.Vector3(0, 0, 0.04);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rotY);
    painting.position.add(offset);
    scene.add(painting); objects.push(painting);

    // Spotlight aimed at painting
    const spotPos = new THREE.Vector3(p.x, H - 0.3, p.z);
    const spotOffset = new THREE.Vector3(0, 0, 1.5);
    spotOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rotY);
    spotPos.add(spotOffset);
    const pl = pointLight(0xffffee, 1.5, spotPos.x, spotPos.y, spotPos.z, 6);
    scene.add(pl); objects.push(pl);
  });

  // Pedestals with sculptures
  const pedestalPositions = [
    [-2, -2], [2, 4], [-6, 6], [7, -4], [0, 8],
  ];
  const sculptureColors = [0xdd4444, 0x4444dd, 0xdddd44, 0x44dddd, 0xdd44dd];
  pedestalPositions.forEach(([px, pz], i) => {
    // Pedestal
    const ped = box(0.8, 1.0, 0.8, 0xfafafa, px, 0.5, pz);
    scene.add(ped); objects.push(ped);
    // Sculpture (abstract shapes)
    if (i % 3 === 0) {
      const sculpt = sphere(0.35, sculptureColors[i], px, 1.35, pz, { roughness: 0.2, metalness: 0.5 });
      scene.add(sculpt); objects.push(sculpt);
    } else if (i % 3 === 1) {
      const sculpt = box(0.4, 0.7, 0.4, sculptureColors[i], px, 1.35, pz, { roughness: 0.3, metalness: 0.4, rotY: 0.5 });
      scene.add(sculpt); objects.push(sculpt);
    } else {
      const sculpt = cylinder(0.15, 0.3, 0.8, sculptureColors[i], px, 1.4, pz, { segments: 5 });
      scene.add(sculpt); objects.push(sculpt);
    }
  });

  // Benches in gallery
  const benchPositions = [[-2, 4], [3, -3]];
  benchPositions.forEach(([bx, bz]) => {
    const bench = box(2, 0.5, 0.6, 0x333333, bx, 0.25, bz, { metalness: 0.2 });
    scene.add(bench); objects.push(bench);
  });

  return {
    objects,
    bounds: { minX: -W/2 + 1, maxX: W/2 - 1, minZ: -D/2 + 1, maxZ: D/2 - 1 },
    seekerSpawn: new THREE.Vector3(0, 1.7, 10),
    hiderSpawn: new THREE.Vector3(-5, 0.75, 0),
  };
}

// ═══════════════ MAP 5: SEWER ═══════════════

function buildSewer(scene) {
  const objects = [];
  const W = 20, D = 28, H = 3.5;

  // Dark ambient
  const ambient = new THREE.AmbientLight(0x224422, 0.3);
  scene.add(ambient); objects.push(ambient);

  // Floor
  const floor = plane(W, D, 0x3a3a2a, 0, 0, 0, { rotX: -Math.PI / 2 });
  scene.add(floor); objects.push(floor);

  // Ceiling (brick)
  const ceil = plane(W, D, 0x443322, 0, H, 0, { rotX: Math.PI / 2 });
  scene.add(ceil); objects.push(ceil);

  // Brick walls
  const brickColor = 0x5c3a21;
  [
    box(W, H, 0.3, brickColor, 0, H/2, -D/2),
    box(W, H, 0.3, brickColor, 0, H/2, D/2),
    box(0.3, H, D, brickColor, -W/2, H/2, 0),
    box(0.3, H, D, brickColor, W/2, H/2, 0),
  ].forEach(w => { scene.add(w); objects.push(w); });

  // Interior tunnel walls
  const tunnelWalls = [
    box(0.3, H, 12, brickColor, -3, H/2, -4),
    box(0.3, H, 12, brickColor, 3, H/2, 4),
    box(6, H, 0.3, brickColor, 6, H/2, -2),
    box(6, H, 0.3, brickColor, -6, H/2, 6),
  ];
  tunnelWalls.forEach(w => { scene.add(w); objects.push(w); });

  // Water channel (central)
  const water = plane(4, D - 2, 0x1a5544, 0, 0.02, 0, {
    rotX: -Math.PI / 2,
    roughness: 0.05,
    metalness: 0.3,
  });
  scene.add(water); objects.push(water);

  // Walkway edges
  const edgeColor = 0x555544;
  [
    box(0.3, 0.3, D - 2, edgeColor, -2.15, 0.15, 0),
    box(0.3, 0.3, D - 2, edgeColor, 2.15, 0.15, 0),
  ].forEach(e => { scene.add(e); objects.push(e); });

  // Pipes on walls and ceiling
  const pipeColor = 0x666655;
  const pipePositions = [
    { x: -W/2 + 0.5, y: 2.5, z1: -12, z2: 12, axis: 'z' },
    { x: W/2 - 0.5, y: 2.5, z1: -12, z2: 12, axis: 'z' },
    { x: -W/2 + 0.5, y: 1.0, z1: -10, z2: 10, axis: 'z' },
    { x: W/2 - 0.5, y: 1.0, z1: -10, z2: 10, axis: 'z' },
  ];
  pipePositions.forEach(p => {
    const len = p.z2 - p.z1;
    const pipe = cylinder(0.08, 0.08, len, pipeColor, p.x, p.y, (p.z1 + p.z2) / 2, { metalness: 0.3 });
    pipe.rotation.x = Math.PI / 2;
    scene.add(pipe); objects.push(pipe);
  });

  // Ceiling pipes (horizontal)
  for (let z = -10; z <= 10; z += 4) {
    const cpipe = cylinder(0.06, 0.06, W - 2, pipeColor, 0, H - 0.3, z, { metalness: 0.3 });
    cpipe.rotation.z = Math.PI / 2;
    scene.add(cpipe); objects.push(cpipe);
  }

  // Grates on walls
  for (let z = -8; z <= 8; z += 4) {
    const grate = box(0.5, 0.5, 0.05, 0x444444, -W/2 + 0.2, 1.5, z, { metalness: 0.4 });
    scene.add(grate); objects.push(grate);
  }

  // Dim point lights (green tint)
  for (let z = -10; z <= 10; z += 5) {
    const pl = pointLight(0x44aa66, 0.8, 0, H - 0.5, z, 8);
    scene.add(pl); objects.push(pl);
  }

  // Barrels / crates
  const barrelPositions = [[-7, -8], [7, -6], [-6, 10], [8, 8], [-8, 3], [7, -12]];
  barrelPositions.forEach(([bx, bz]) => {
    const barrel = cylinder(0.4, 0.4, 0.9, 0x6B4226, bx, 0.45, bz, { segments: 10 });
    scene.add(barrel); objects.push(barrel);
  });

  // Crates
  const cratePositions = [[-8, -5], [6, 3], [-5, 8], [8, -10]];
  cratePositions.forEach(([cx, cz]) => {
    const crate = box(0.8, 0.8, 0.8, 0x7a6a4a, cx, 0.4, cz);
    scene.add(crate); objects.push(crate);
  });

  // Ladder on wall
  const ladderColor = 0x777766;
  const ladderX = W/2 - 0.3;
  for (let y = 0.3; y <= H - 0.3; y += 0.4) {
    const rung = cylinder(0.03, 0.03, 0.5, ladderColor, ladderX, y, 0, { segments: 6 });
    rung.rotation.y = Math.PI / 2;
    scene.add(rung); objects.push(rung);
  }
  [0.25, -0.25].forEach(zOff => {
    const rail = cylinder(0.03, 0.03, H, ladderColor, ladderX, H/2, zOff);
    scene.add(rail); objects.push(rail);
  });

  return {
    objects,
    bounds: { minX: -W/2 + 1, maxX: W/2 - 1, minZ: -D/2 + 1, maxZ: D/2 - 1 },
    seekerSpawn: new THREE.Vector3(-7, 1.7, -12),
    hiderSpawn: new THREE.Vector3(5, 0.75, 5),
  };
}
