// ============================================================
// INDOOR ENVIRONMENT - Recreational Airsoft Center
// ============================================================
// This module creates an indoor CQB (Close Quarters Battle)
// environment simulating a real-world recreational airsoft
// center with wooden maze walls, safety netting, crates,
// decorations, and indoor-adapted AI behavior.
//
// Usage: Called from AirsoftRoyale.html when player selects
// "Indoor CQB" map. Replaces outdoor terrain/buildings with
// indoor facility. Uses the same Game object, physics world,
// weapon system, and game loop from the main file.
// ============================================================
'use strict';

// ============ INDOOR CONSTANTS ============
const INDOOR_SIZE = 120;         // Facility is 120x120 units
const INDOOR_HALF = INDOOR_SIZE / 2;
const WALL_HEIGHT = 5;           // Maze wall height (plywood panels)
const FACILITY_CEILING = 8;      // Building ceiling height
const MAZE_WALL_THICKNESS = 0.3; // Plywood thickness
const INDOOR_MAX_ENEMIES = 6;    // Fewer enemies in tight space

// ============ INDOOR MATERIALS (created once) ============
let indoorMats = null;

function getIndoorMaterials() {
  if (indoorMats) return indoorMats;
  indoorMats = {
    // Plywood maze walls — warm wood tone
    plywood: new THREE.MeshStandardMaterial({
      color: 0xC4A35A, roughness: 0.85, metalness: 0.0
    }),
    // Darker plywood for variety
    plywoodDark: new THREE.MeshStandardMaterial({
      color: 0x9E8340, roughness: 0.9, metalness: 0.0
    }),
    // Concrete floor — polished gray
    floor: new THREE.MeshStandardMaterial({
      color: 0x888888, roughness: 0.6, metalness: 0.1
    }),
    // Rubber safety mat (black)
    safetyMat: new THREE.MeshStandardMaterial({
      color: 0x2a2a2a, roughness: 0.95, metalness: 0.0
    }),
    // Exterior walls — painted cinderblock
    cinderblock: new THREE.MeshStandardMaterial({
      color: 0x707070, roughness: 0.8, metalness: 0.05
    }),
    // Ceiling — exposed metal deck
    ceiling: new THREE.MeshStandardMaterial({
      color: 0x5a5a5a, roughness: 0.7, metalness: 0.3
    }),
    // Wooden crates
    crate: new THREE.MeshStandardMaterial({
      color: 0xB8860B, roughness: 0.8, metalness: 0.0
    }),
    // Safety netting (yellow-green)
    netting: new THREE.MeshStandardMaterial({
      color: 0x88AA33, roughness: 0.9, metalness: 0.0,
      transparent: true, opacity: 0.6, side: THREE.DoubleSide
    }),
    // Caution stripe tape
    caution: new THREE.MeshStandardMaterial({
      color: 0xFFCC00, roughness: 0.5, metalness: 0.1
    }),
    // Metal barrel / drum
    metalDrum: new THREE.MeshStandardMaterial({
      color: 0x3a5a3a, roughness: 0.5, metalness: 0.4
    }),
    // Red accent (signs, markings)
    redAccent: new THREE.MeshStandardMaterial({
      color: 0xCC2222, roughness: 0.5
    }),
    // Blue accent (team markers)
    blueAccent: new THREE.MeshStandardMaterial({
      color: 0x2244CC, roughness: 0.5
    }),
    // Tire stack rubber
    tire: new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, roughness: 0.95, metalness: 0.0
    }),
    // White paint on walls
    whitePaint: new THREE.MeshStandardMaterial({
      color: 0xEEEEEE, roughness: 0.7, metalness: 0.0
    }),
    // Corrugated metal panels
    corrugated: new THREE.MeshStandardMaterial({
      color: 0x667788, roughness: 0.6, metalness: 0.4
    })
  };
  return indoorMats;
}

// ============ INDOOR COLLECTIONS ============
let indoorObjects = [];       // All THREE.Object3D added, for cleanup
let indoorPhysicsBodies = []; // Static indoor CANNON bodies to clean on restart
let indoorMinimapLastUpdateMs = 0;
let darkModeData = {
  playerFlashlight: null,
  playerTarget: null,
};

const DARK_MODE_FLASHLIGHT_RANGE = 30;
const DARK_MODE_FLASHLIGHT_ANGLE = Math.PI / 9;
const DARK_MODE_FLASHLIGHT_PENUMBRA = 0.5;

function addIndoorObj(obj) {
  indoorObjects.push(obj);
  Game.scene.add(obj);
}

function addIndoorPhysBox(w, h, d, x, y, z) {
  addPhysBox(w, h, d, x, y, z);
  if (Game.world && Game.world.bodies.length > 0) {
    indoorPhysicsBodies.push(Game.world.bodies[Game.world.bodies.length - 1]);
  }
}

// ============ MASTER BUILD FUNCTION ============
function buildIndoorEnvironment() {
  // Prevent duplicate indoor meshes/bodies when restarting indoor matches.
  clearIndoorEnvironment();
  getIndoorMaterials();
  indoorObjects = [];
  indoorPhysicsBodies = [];
  indoorMinimapLastUpdateMs = 0;

  createFacilityShell();
  createFloor();
  createMazeWalls();
  createWoodenCrates();
  createTireStacks();
  createBarrels();
  createSafetyNetting();
  createDecorations();
  createSpawnAreas();
  setupIndoorLighting();
}

// ============ CLEANUP ============
function clearIndoorEnvironment() {
  indoorObjects.forEach(obj => {
    Game.scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
  indoorObjects = [];

  if (Game.world) {
    indoorPhysicsBodies.forEach(body => {
      if (body && Game.world.bodies.includes(body)) {
        Game.world.removeBody(body);
      }
    });
  }
  indoorPhysicsBodies = [];

  if (darkModeData.playerFlashlight && Game.camera) {
    Game.camera.remove(darkModeData.playerFlashlight);
  }
  if (darkModeData.playerTarget && Game.camera) {
    Game.camera.remove(darkModeData.playerTarget);
  }
  darkModeData.playerFlashlight = null;
  darkModeData.playerTarget = null;
}

// ============ FACILITY SHELL ============
// The outer building: four cinderblock walls + ceiling + no sky visible
function createFacilityShell() {
  const M = getIndoorMaterials();
  const S = INDOOR_SIZE;
  const H = FACILITY_CEILING;
  const T = 1.0; // Outer wall thickness

  // Four outer walls
  const wallConfigs = [
    // [width, height, depth, x, y, z]
    [S + T * 2, H, T, 0, H / 2, -S / 2 - T / 2],   // North
    [S + T * 2, H, T, 0, H / 2, S / 2 + T / 2],     // South
    [T, H, S, -S / 2 - T / 2, H / 2, 0],             // West
    [T, H, S, S / 2 + T / 2, H / 2, 0],              // East
  ];

  wallConfigs.forEach(([w, h, d, x, y, z]) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, M.cinderblock);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addIndoorObj(mesh);
    addIndoorPhysBox(w, h, d, x, y, z);
  });

  // Ceiling
  const ceilGeo = new THREE.BoxGeometry(S + T * 2, 0.3, S + T * 2);
  const ceilMesh = new THREE.Mesh(ceilGeo, M.ceiling);
  ceilMesh.position.set(0, H, 0);
  ceilMesh.receiveShadow = true;
  addIndoorObj(ceilMesh);
  addIndoorPhysBox(S + T * 2, 0.3, S + T * 2, 0, H, 0);

  // Block the sky — large dark box above
  const skyBlockGeo = new THREE.BoxGeometry(S * 3, 1, S * 3);
  const skyBlockMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const skyBlock = new THREE.Mesh(skyBlockGeo, skyBlockMat);
  skyBlock.position.set(0, H + 5, 0);
  addIndoorObj(skyBlock);
}

// ============ FLOOR ============
function createFloor() {
  const M = getIndoorMaterials();

  // Main concrete floor
  const floorGeo = new THREE.PlaneGeometry(INDOOR_SIZE, INDOOR_SIZE);
  const floor = new THREE.Mesh(floorGeo, M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  floor.receiveShadow = true;
  addIndoorObj(floor);

  // Safety rubber mats in spawn zones
  const matPositions = [
    [-INDOOR_HALF + 10, 0.02, -INDOOR_HALF + 10],
    [INDOOR_HALF - 10, 0.02, INDOOR_HALF - 10]
  ];
  matPositions.forEach(([x, y, z]) => {
    const matGeo = new THREE.PlaneGeometry(14, 14);
    const mat = new THREE.Mesh(matGeo, M.safetyMat);
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(x, y, z);
    mat.receiveShadow = true;
    addIndoorObj(mat);
  });

  // Court markings / lines on the floor
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
  // Center line
  const centerLine = new THREE.Mesh(
    new THREE.PlaneGeometry(INDOOR_SIZE * 0.8, 0.15),
    lineMat
  );
  centerLine.rotation.x = -Math.PI / 2;
  centerLine.position.set(0, 0.03, 0);
  addIndoorObj(centerLine);

  // Side lines
  [-1, 1].forEach(side => {
    const sideLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, INDOOR_SIZE * 0.8),
      lineMat
    );
    sideLine.rotation.x = -Math.PI / 2;
    sideLine.position.set(side * INDOOR_HALF * 0.4, 0.03, 0);
    addIndoorObj(sideLine);
  });
}

// ============ MAZE WALLS ============
// Plywood walls creating a chopped-up CQB maze with multiple
// openings, corridors, and rooms. Real airsoft centers use
// plywood/pallet walls that are intentionally gapped.
function createMazeWalls() {
  const M = getIndoorMaterials();
  const WH = WALL_HEIGHT;
  const WT = MAZE_WALL_THICKNESS;

  // Each wall definition:
  // x,z = center position, len = length, rot = rotation
  // mat = material key, openAt = normalized gap position (0-1), openW = gap width
  const wallDefs = [
    // === NORTH ZONE (top half) ===
    // Long east-west corridors
    { x: -30, z: -40, len: 25, rot: 0, mat: 'plywood', openAt: 0.4, openW: 3 },
    { x: 10, z: -40, len: 20, rot: 0, mat: 'plywoodDark', openAt: 0.7, openW: 3 },
    { x: 38, z: -40, len: 18, rot: 0, mat: 'plywood' },
    { x: -20, z: -25, len: 30, rot: 0, mat: 'plywoodDark', openAt: 0.3, openW: 3.5 },
    { x: 25, z: -25, len: 22, rot: 0, mat: 'plywood', openAt: 0.6, openW: 3 },

    // North-south dividers
    { x: -40, z: -32, len: 15, rot: Math.PI / 2, mat: 'plywood', openAt: 0.5, openW: 3 },
    { x: -10, z: -35, len: 20, rot: Math.PI / 2, mat: 'plywoodDark' },
    { x: 15, z: -30, len: 12, rot: Math.PI / 2, mat: 'plywood', openAt: 0.4, openW: 2.5 },
    { x: 40, z: -28, len: 18, rot: Math.PI / 2, mat: 'plywoodDark', openAt: 0.7, openW: 3 },

    // === CENTER ZONE ===
    // The "kill house" — a central room with multiple entries
    { x: -8, z: -5, len: 16, rot: 0, mat: 'plywood', openAt: 0.5, openW: 3.5 },
    { x: -8, z: 5, len: 16, rot: 0, mat: 'plywood', openAt: 0.3, openW: 3 },
    { x: -16, z: 0, len: 10, rot: Math.PI / 2, mat: 'plywoodDark', openAt: 0.6, openW: 3 },
    { x: 0, z: 0, len: 10, rot: Math.PI / 2, mat: 'plywoodDark', openAt: 0.4, openW: 3 },

    // Flanking corridors around center
    { x: -35, z: -5, len: 20, rot: 0, mat: 'plywood' },
    { x: -35, z: 8, len: 15, rot: 0, mat: 'plywoodDark', openAt: 0.5, openW: 3 },
    { x: 30, z: -8, len: 18, rot: 0, mat: 'plywood', openAt: 0.35, openW: 3 },
    { x: 30, z: 5, len: 22, rot: 0, mat: 'plywoodDark', openAt: 0.65, openW: 3 },

    // Cross connectors
    { x: -25, z: 0, len: 10, rot: Math.PI / 2, mat: 'plywood', openAt: 0.5, openW: 2.5 },
    { x: 20, z: -2, len: 14, rot: Math.PI / 2, mat: 'plywoodDark', openAt: 0.4, openW: 3 },

    // === SOUTH ZONE (bottom half) ===
    { x: -25, z: 20, len: 20, rot: 0, mat: 'plywood', openAt: 0.6, openW: 3 },
    { x: 15, z: 22, len: 25, rot: 0, mat: 'plywoodDark', openAt: 0.3, openW: 3.5 },
    { x: -10, z: 35, len: 30, rot: 0, mat: 'plywood', openAt: 0.5, openW: 3 },
    { x: 30, z: 35, len: 18, rot: 0, mat: 'plywoodDark', openAt: 0.7, openW: 3 },
    { x: -35, z: 40, len: 14, rot: 0, mat: 'plywood' },

    // South north-south dividers
    { x: -40, z: 28, len: 16, rot: Math.PI / 2, mat: 'plywoodDark', openAt: 0.5, openW: 3 },
    { x: -15, z: 30, len: 18, rot: Math.PI / 2, mat: 'plywood', openAt: 0.4, openW: 3 },
    { x: 8, z: 28, len: 12, rot: Math.PI / 2, mat: 'plywoodDark' },
    { x: 35, z: 25, len: 20, rot: Math.PI / 2, mat: 'plywood', openAt: 0.6, openW: 3 },
    { x: 45, z: 38, len: 14, rot: Math.PI / 2, mat: 'plywoodDark', openAt: 0.5, openW: 2.5 },

    // === ANGLED WALLS (creates interesting sight lines) ===
    { x: -28, z: -15, len: 10, rot: Math.PI / 4, mat: 'plywood' },
    { x: 25, z: 15, len: 10, rot: -Math.PI / 4, mat: 'plywoodDark' },
    { x: 42, z: -15, len: 8, rot: Math.PI / 6, mat: 'plywood' },
    { x: -45, z: 20, len: 8, rot: -Math.PI / 6, mat: 'plywoodDark' },
  ];

  wallDefs.forEach(def => {
    buildMazeWall(def, WH, WT);
  });

  // Half-height cover walls (crouch walls) — you can shoot over them standing
  const halfWalls = [
    { x: -5, z: -20, len: 6, rot: 0, mat: 'plywood' },
    { x: 10, z: -15, len: 8, rot: Math.PI / 2, mat: 'plywoodDark' },
    { x: -20, z: 10, len: 7, rot: 0, mat: 'plywood' },
    { x: 25, z: -20, len: 5, rot: Math.PI / 2, mat: 'plywoodDark' },
    { x: -30, z: 30, len: 6, rot: 0, mat: 'plywood' },
    { x: 10, z: 40, len: 5, rot: Math.PI / 2, mat: 'plywoodDark' },
    { x: 40, z: 10, len: 6, rot: 0, mat: 'plywood' },
    { x: -45, z: -10, len: 5, rot: Math.PI / 2, mat: 'plywoodDark' },
  ];

  halfWalls.forEach(def => {
    buildMazeWall(def, WH * 0.5, WT);
  });
}

function buildMazeWall(def, height, thickness) {
  const M = getIndoorMaterials();
  const mat = M[def.mat] || M.plywood;

  if (def.openAt !== undefined && def.openW) {
    // Wall with a doorway opening
    const openCenter = def.openAt * def.len;
    const gapHalf = def.openW / 2;

    // Left segment
    const leftLen = openCenter - gapHalf;
    if (leftLen > 0.3) {
      const leftOffset = -def.len / 2 + leftLen / 2;
      createWallSegment(
        def.x + Math.cos(def.rot || 0) * leftOffset,
        def.z + Math.sin(def.rot || 0) * leftOffset,
        leftLen, height, thickness, def.rot || 0, mat
      );
    }

    // Right segment
    const rightLen = def.len - openCenter - gapHalf;
    if (rightLen > 0.3) {
      const rightOffset = def.len / 2 - rightLen / 2;
      createWallSegment(
        def.x + Math.cos(def.rot || 0) * rightOffset,
        def.z + Math.sin(def.rot || 0) * rightOffset,
        rightLen, height, thickness, def.rot || 0, mat
      );
    }

    // Door frame header (above the opening)
    const headerH = 0.4;
    const headerY = height - headerH / 2;
    createWallSegment(
      def.x + Math.cos(def.rot || 0) * (leftLen - def.len / 2 + gapHalf),
      def.z + Math.sin(def.rot || 0) * (leftLen - def.len / 2 + gapHalf),
      def.openW + 0.2, headerH, thickness, def.rot || 0, mat
    );
  } else {
    // Solid wall (no opening)
    createWallSegment(def.x, def.z, def.len, height, thickness, def.rot || 0, mat);
  }
}

function createWallSegment(x, z, len, height, thickness, rotation, material) {
  // Visual mesh
  const geo = new THREE.BoxGeometry(len, height, thickness);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, height / 2, z);
  mesh.rotation.y = rotation;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addIndoorObj(mesh);

  // Plywood edge trim (darker strip along top)
  const trimGeo = new THREE.BoxGeometry(len + 0.1, 0.08, thickness + 0.05);
  const trimMat = getIndoorMaterials().plywoodDark;
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.set(x, height, z);
  trim.rotation.y = rotation;
  addIndoorObj(trim);

  // Physics — approximate for rotated walls
  if (Math.abs(rotation) < 0.01 || Math.abs(rotation - Math.PI) < 0.01) {
    // Axis-aligned (east-west)
    addIndoorPhysBox(len, height, thickness, x, height / 2, z);
  } else if (Math.abs(rotation - Math.PI / 2) < 0.01 || Math.abs(rotation + Math.PI / 2) < 0.01) {
    // Axis-aligned (north-south)
    addIndoorPhysBox(thickness, height, len, x, height / 2, z);
  } else {
    // Angled wall — approximate with AABB bounding box
    const cosR = Math.abs(Math.cos(rotation));
    const sinR = Math.abs(Math.sin(rotation));
    const bw = len * cosR + thickness * sinR;
    const bd = len * sinR + thickness * cosR;
    addIndoorPhysBox(bw, height, bd, x, height / 2, z);
  }
}

// ============ WOODEN CRATES ============
// Scattered throughout for cover, stacked in various configs
function createWoodenCrates() {
  const M = getIndoorMaterials();

  // Single crate positions: [x, z, size, rotation]
  const singleCrates = [
    [-5, -30, 1.5, 0.2], [12, -18, 1.2, 0.5], [-22, 5, 1.4, 0],
    [18, 8, 1.3, 0.8], [-38, -20, 1.5, 0.1], [35, -30, 1.2, 0.6],
    [-28, 25, 1.5, 0.3], [8, 30, 1.4, 0], [-15, -45, 1.3, 0.4],
    [40, 20, 1.2, 0.7], [-42, 35, 1.5, 0.2], [22, 42, 1.3, 0.5],
    [-8, 15, 1.2, 0], [32, -10, 1.4, 0.3], [-48, -5, 1.5, 0.6],
  ];

  singleCrates.forEach(([x, z, size, rot]) => {
    createCrateObj(x, size / 2, z, size, size, size, rot);
  });

  // Stacked double crates (2 high)
  const doubleCrates = [
    [-30, -35, 1.3], [20, -35, 1.2], [-10, 25, 1.4],
    [38, 15, 1.3], [-45, -30, 1.2], [45, -20, 1.3],
  ];

  doubleCrates.forEach(([x, z, size]) => {
    // Bottom crate
    createCrateObj(x, size / 2, z, size, size, size, 0);
    // Top crate (slightly offset for realism)
    createCrateObj(x + 0.1, size * 1.5, z + 0.1, size, size, size, 0.15);
  });

  // Triple stack (3 high, forming a sniper perch in a corner)
  const tripleX = -48, tripleZ = -48, tripleS = 1.5;
  for (let i = 0; i < 3; i++) {
    createCrateObj(tripleX, tripleS / 2 + i * tripleS, tripleZ, tripleS, tripleS, tripleS, i * 0.05);
  }
  // Adjacent crates for stairway approach
  createCrateObj(tripleX + 2, tripleS / 2, tripleZ, tripleS, tripleS, tripleS, 0);
  createCrateObj(tripleX + 2, tripleS * 1.5, tripleZ, tripleS, tripleS, tripleS, 0.08);
}

function createCrateObj(x, y, z, w, h, d, rot) {
  const M = getIndoorMaterials();

  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, M.crate);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rot || 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addIndoorObj(mesh);

  // Cross bracing lines on the crate face
  const lineGeo = new THREE.BoxGeometry(w * 1.01, 0.04, 0.04);
  const lineMat = getIndoorMaterials().plywoodDark;
  const line1 = new THREE.Mesh(lineGeo, lineMat);
  line1.position.set(x, y + h * 0.2, z + d / 2 + 0.02);
  line1.rotation.y = rot || 0;
  addIndoorObj(line1);
  const line2 = new THREE.Mesh(lineGeo, lineMat);
  line2.position.set(x, y - h * 0.2, z + d / 2 + 0.02);
  line2.rotation.y = rot || 0;
  addIndoorObj(line2);

  // Physics
  addIndoorPhysBox(w, h, d, x, y, z);
}

// ============ TIRE STACKS ============
// Real airsoft centers use old tires as cover
function createTireStacks() {
  const M = getIndoorMaterials();

  const tirePositions = [
    [-18, -28], [22, -12], [-35, 15], [40, 30],
    [-5, 42], [15, -42], [-40, -40], [30, 38],
    [48, 0], [-48, 18]
  ];

  tirePositions.forEach(([x, z]) => {
    const stackH = 2 + Math.floor(Math.random() * 3); // 2-4 tires high
    for (let i = 0; i < stackH; i++) {
      const tireGeo = new THREE.TorusGeometry(0.7, 0.3, 8, 12);
      const tire = new THREE.Mesh(tireGeo, M.tire);
      tire.position.set(x, 0.3 + i * 0.55, z);
      tire.rotation.x = Math.PI / 2;
      tire.rotation.z = Math.random() * 0.3;
      tire.castShadow = true;
      tire.receiveShadow = true;
      addIndoorObj(tire);
    }
    // Physics approximation (cylinder)
    addIndoorPhysBox(1.6, stackH * 0.55, 1.6, x, (stackH * 0.55) / 2, z);
  });
}

// ============ BARRELS ============
// Oil drums, paint cans — common in airsoft arenas
function createBarrels() {
  const M = getIndoorMaterials();

  const barrelPositions = [
    [-12, -10, false], [8, -35, false], [-32, 30, true],
    [42, -25, false], [-25, -18, true], [18, 20, false],
    [-42, 8, false], [30, -42, true], [-8, 38, false],
    [48, -38, false], [-48, -25, true], [12, 48, false]
  ];

  barrelPositions.forEach(([x, z, knocked]) => {
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 10);
    const mesh = new THREE.Mesh(geo, M.metalDrum);

    if (knocked) {
      // Knocked-over barrel (on its side)
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(x, 0.5, z);
    } else {
      mesh.position.set(x, 0.75, z);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addIndoorObj(mesh);

    // Physics
    if (knocked) {
      addIndoorPhysBox(1.5, 1, 1, x, 0.5, z);
    } else {
      addIndoorPhysBox(1, 1.5, 1, x, 0.75, z);
    }
  });
}

// ============ SAFETY NETTING ============
// Real airsoft arenas have netting around spawn, spectator areas
function createSafetyNetting() {
  const M = getIndoorMaterials();
  const netH = 4;

  // Netting around spawn zones (protects respawning players)
  const netConfigs = [
    // Alpha spawn net (southwest corner)
    { x: -INDOOR_HALF + 17, z: -INDOOR_HALF + 3, w: 0.1, h: netH, d: 14, label: 'ALPHA SPAWN' },
    { x: -INDOOR_HALF + 3, z: -INDOOR_HALF + 10, w: 14, h: netH, d: 0.1, label: null },
    // Bravo spawn net (northeast corner)
    { x: INDOOR_HALF - 17, z: INDOOR_HALF - 3, w: 0.1, h: netH, d: 14, label: 'BRAVO SPAWN' },
    { x: INDOOR_HALF - 3, z: INDOOR_HALF - 10, w: 14, h: netH, d: 0.1, label: null },
  ];

  netConfigs.forEach(nc => {
    const geo = new THREE.BoxGeometry(nc.w, nc.h, nc.d);
    const mesh = new THREE.Mesh(geo, M.netting);
    mesh.position.set(nc.x, nc.h / 2, nc.z);
    addIndoorObj(mesh);

    if (nc.label) {
      // Sign above netting
      const signGeo = new THREE.BoxGeometry(6, 0.8, 0.1);
      const signMat = nc.label.includes('ALPHA') ? M.blueAccent : M.redAccent;
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(nc.x, netH + 0.5, nc.z);
      if (nc.w < 1) sign.rotation.y = Math.PI / 2;
      addIndoorObj(sign);
    }
  });
}

// ============ DECORATIONS ============
// Posters, signs, props that make it feel like a real center
function createDecorations() {
  const M = getIndoorMaterials();

  // "AIRSOFT ROYALE" banner on north wall interior
  const bannerGeo = new THREE.PlaneGeometry(20, 3);
  const bannerMat = new THREE.MeshStandardMaterial({
    color: 0xFF6B35, roughness: 0.5, side: THREE.DoubleSide
  });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, FACILITY_CEILING - 2, -INDOOR_HALF + 1.1);
  addIndoorObj(banner);

  // Rule signs on walls
  const ruleSigns = [
    { x: -INDOOR_HALF + 1.1, z: -20, rot: Math.PI / 2, color: 0xFFCC00 },
    { x: INDOOR_HALF - 1.1, z: 20, rot: -Math.PI / 2, color: 0xFFCC00 },
    { x: -20, z: INDOOR_HALF - 1.1, rot: Math.PI, color: 0xFF4444 },
    { x: 20, z: -INDOOR_HALF + 1.1, rot: 0, color: 0x44FF44 },
  ];

  ruleSigns.forEach(rs => {
    const signGeo = new THREE.PlaneGeometry(3, 2);
    const signMat = new THREE.MeshStandardMaterial({
      color: rs.color, roughness: 0.6, side: THREE.DoubleSide
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(rs.x, 3, rs.z);
    sign.rotation.y = rs.rot;
    addIndoorObj(sign);
  });

  // Benches along the walls (staging area feel)
  const benchPositions = [
    [-INDOOR_HALF + 2, -30], [-INDOOR_HALF + 2, -20],
    [-INDOOR_HALF + 2, 30], [-INDOOR_HALF + 2, 40],
  ];
  benchPositions.forEach(([x, z]) => {
    createBench(x, z);
  });

  // Vending machine style prop (corner decoration)
  const vmGeo = new THREE.BoxGeometry(1.2, 2.2, 0.8);
  const vmMat = new THREE.MeshStandardMaterial({ color: 0x2244AA, roughness: 0.4, metalness: 0.3 });
  const vm = new THREE.Mesh(vmGeo, vmMat);
  vm.position.set(INDOOR_HALF - 2, 1.1, -INDOOR_HALF + 2);
  vm.castShadow = true;
  addIndoorObj(vm);
  addIndoorPhysBox(1.2, 2.2, 0.8, INDOOR_HALF - 2, 1.1, -INDOOR_HALF + 2);

  // Another vending machine in opposite corner
  const vm2 = new THREE.Mesh(vmGeo.clone(), new THREE.MeshStandardMaterial({ color: 0xAA2222, roughness: 0.4, metalness: 0.3 }));
  vm2.position.set(-INDOOR_HALF + 2, 1.1, INDOOR_HALF - 2);
  vm2.castShadow = true;
  addIndoorObj(vm2);
  addIndoorPhysBox(1.2, 2.2, 0.8, -INDOOR_HALF + 2, 1.1, INDOOR_HALF - 2);

  // Corrugated metal accent panels (industrial look, scattered)
  const corrPanels = [
    { x: -30, z: -15, rot: 0, w: 8, h: 3 },
    { x: 15, z: 25, rot: Math.PI / 2, w: 6, h: 3 },
    { x: 40, z: -5, rot: 0, w: 5, h: 2.5 },
  ];
  corrPanels.forEach(cp => {
    const pGeo = new THREE.BoxGeometry(cp.w, cp.h, 0.15);
    const pMesh = new THREE.Mesh(pGeo, M.corrugated);
    pMesh.position.set(cp.x, cp.h / 2, cp.z);
    pMesh.rotation.y = cp.rot;
    pMesh.castShadow = true;
    addIndoorObj(pMesh);
    // Thin decorative — add physics for cover
    if (cp.rot === 0) addIndoorPhysBox(cp.w, cp.h, 0.15, cp.x, cp.h / 2, cp.z);
    else addIndoorPhysBox(0.15, cp.h, cp.w, cp.x, cp.h / 2, cp.z);
  });

  // Caution tape on floor near spawn exits
  [-1, 1].forEach(side => {
    const tapGeo = new THREE.PlaneGeometry(4, 0.3);
    const tape = new THREE.Mesh(tapGeo, M.caution);
    tape.rotation.x = -Math.PI / 2;
    tape.position.set(side * (INDOOR_HALF - 15), 0.04, side * (INDOOR_HALF - 17));
    addIndoorObj(tape);
  });
}

function createBench(x, z) {
  const woodMat = getIndoorMaterials().plywoodDark;
  // Seat
  const seatGeo = new THREE.BoxGeometry(0.6, 0.08, 2.5);
  const seat = new THREE.Mesh(seatGeo, woodMat);
  seat.position.set(x, 0.55, z);
  seat.castShadow = true;
  addIndoorObj(seat);
  // Legs
  const legGeo = new THREE.BoxGeometry(0.08, 0.55, 0.08);
  [[-0.25, z - 1], [-0.25, z + 1], [0.25, z - 1], [0.25, z + 1]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(x + lx, 0.275, lz);
    addIndoorObj(leg);
  });
  addIndoorPhysBox(0.6, 0.55, 2.5, x, 0.275, z);
}

// ============ SPAWN AREAS ============
// Designated safe zones per team — visual markers
function createSpawnAreas() {
  const M = getIndoorMaterials();

  // Alpha spawn marker (southwest)
  const alphaGeo = new THREE.RingGeometry(3, 3.3, 32);
  const alpha = new THREE.Mesh(alphaGeo, new THREE.MeshBasicMaterial({ color: 0x4488FF, side: THREE.DoubleSide }));
  alpha.rotation.x = -Math.PI / 2;
  alpha.position.set(-INDOOR_HALF + 10, 0.04, -INDOOR_HALF + 10);
  addIndoorObj(alpha);

  // Bravo spawn marker (northeast)
  const bravoGeo = new THREE.RingGeometry(3, 3.3, 32);
  const bravo = new THREE.Mesh(bravoGeo, new THREE.MeshBasicMaterial({ color: 0xFF4444, side: THREE.DoubleSide }));
  bravo.rotation.x = -Math.PI / 2;
  bravo.position.set(INDOOR_HALF - 10, 0.04, INDOOR_HALF - 10);
  addIndoorObj(bravo);
}

// ============ INDOOR LIGHTING ============
// Indoor arenas typically have overhead fluorescent / industrial lights
// No sunlight, no sky — everything is artificial
function setupIndoorLighting() {
  // Dark mode uses minimal ambient and tactical flashlights.
  if (Game.darkMode) {
    setupIndoorDarkLighting();
    return;
  }

  // Remove outdoor lights by swapping scene fog & background
  Game.scene.background = new THREE.Color(0x111111);
  Game.scene.fog = new THREE.FogExp2(0x111111, 0.008);

  // Overhead fluorescent light strips (PointLights simulating tube lights)
  const lightColor = 0xFFEEDD;  // Warm white (typical indoor)
  const lightIntensity = 0.65;
  const lightDist = 36;

  // Grid of overhead lights
  // Larger spacing keeps the look while reducing expensive light count.
  const spacing = 30;
  for (let x = -INDOOR_HALF + spacing / 2; x <= INDOOR_HALF - spacing / 2; x += spacing) {
    for (let z = -INDOOR_HALF + spacing / 2; z <= INDOOR_HALF - spacing / 2; z += spacing) {
      const light = new THREE.PointLight(lightColor, lightIntensity, lightDist, 1.5);
      light.position.set(x, FACILITY_CEILING - 0.5, z);
      light.castShadow = false; // Too many lights for shadows, rely on main
      addIndoorObj(light);

      // Light fixture mesh (simple box)
      const fixGeo = new THREE.BoxGeometry(1.6, 0.12, 0.4);
      const fixMat = new THREE.MeshStandardMaterial({
        color: 0xDDDDDD, roughness: 0.3, metalness: 0.5,
        emissive: 0xFFEEDD, emissiveIntensity: 0.6
      });
      const fix = new THREE.Mesh(fixGeo, fixMat);
      fix.position.set(x, FACILITY_CEILING - 0.2, z);
      addIndoorObj(fix);
    }
  }

  // Stronger accent lights at spawn zones
  const spawnLight1 = new THREE.PointLight(0x4488FF, 0.5, 25);
  spawnLight1.position.set(-INDOOR_HALF + 10, FACILITY_CEILING - 1, -INDOOR_HALF + 10);
  addIndoorObj(spawnLight1);

  const spawnLight2 = new THREE.PointLight(0xFF4444, 0.5, 25);
  spawnLight2.position.set(INDOOR_HALF - 10, FACILITY_CEILING - 1, INDOOR_HALF - 10);
  addIndoorObj(spawnLight2);

  // Ambient to ensure nothing is pitch black
  const ambient = new THREE.AmbientLight(0x444444, 0.6);
  addIndoorObj(ambient);
}

function setupIndoorDarkLighting() {
  // Push unlit areas close to black so flashlight beams dominate visibility.
  Game.scene.background = new THREE.Color(0x000000);
  Game.scene.fog = new THREE.FogExp2(0x000000, 0.06);

  // Near-zero ambient to keep non-beam areas extremely dark.
  const ambient = new THREE.AmbientLight(0x020304, 0.006);
  addIndoorObj(ambient);

  // Tiny emergency glows only at spawn corners.
  const emergencyA = new THREE.PointLight(0x1b2a44, 0.008, 4, 2.6);
  emergencyA.position.set(-INDOOR_HALF + 8, FACILITY_CEILING - 1, -INDOOR_HALF + 8);
  addIndoorObj(emergencyA);

  const emergencyB = new THREE.PointLight(0x3a1a1a, 0.008, 4, 2.6);
  emergencyB.position.set(INDOOR_HALF - 8, FACILITY_CEILING - 1, INDOOR_HALF - 8);
  addIndoorObj(emergencyB);

  createPlayerFlashlight();
}

function createPlayerFlashlight() {
  if (!Game.camera) return;

  if (darkModeData.playerFlashlight) Game.camera.remove(darkModeData.playerFlashlight);
  if (darkModeData.playerTarget) Game.camera.remove(darkModeData.playerTarget);

  const light = new THREE.SpotLight(0xe6f2ff, 2.6, DARK_MODE_FLASHLIGHT_RANGE + 6, DARK_MODE_FLASHLIGHT_ANGLE, DARK_MODE_FLASHLIGHT_PENUMBRA, 1.35);
  light.castShadow = false;
  light.position.set(0, 0.18, 0.08);

  const target = new THREE.Object3D();
  target.position.set(0, 0.0, -10);

  Game.camera.add(light);
  Game.camera.add(target);
  light.target = target;

  darkModeData.playerFlashlight = light;
  darkModeData.playerTarget = target;
}

function addEnemyFlashlight(enemy) {
  const headLamp = new THREE.SpotLight(0xccddff, 1.55, 26, DARK_MODE_FLASHLIGHT_ANGLE, DARK_MODE_FLASHLIGHT_PENUMBRA, 1.7);
  headLamp.castShadow = false;
  headLamp.position.set(0, 1.62, 0.02);

  const target = new THREE.Object3D();
  target.position.set(0, 1.4, -8);

  enemy.mesh.add(headLamp);
  enemy.mesh.add(target);
  headLamp.target = target;

  // Small lamp lens for readability in darkness.
  const lampGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xaaccff });
  const lampMesh = new THREE.Mesh(lampGeo, lampMat);
  lampMesh.position.set(0, 1.62, -0.18);
  enemy.mesh.add(lampMesh);

  enemy.flashlight = headLamp;
  enemy.flashlightTarget = target;
}

function isPlayerInEnemyFlashlight(enemy) {
  if (!enemy.flashlight || !enemy.flashlightTarget) return false;
  if (!Game.player.isAlive) return false;

  const source = new THREE.Vector3();
  const target = new THREE.Vector3();
  const toPlayer = new THREE.Vector3();
  const beamDir = new THREE.Vector3();

  enemy.flashlight.getWorldPosition(source);
  enemy.flashlightTarget.getWorldPosition(target);
  beamDir.subVectors(target, source).normalize();
  toPlayer.subVectors(Game.camera.position, source);

  const dist = toPlayer.length();
  if (dist > enemy.flashlight.distance) return false;
  if (dist < 0.001) return true;

  toPlayer.normalize();
  const angleCos = beamDir.dot(toPlayer);
  const threshold = Math.cos(enemy.flashlight.angle);
  if (angleCos < threshold) return false;

  if (typeof hasLineOfSight === 'function' && !hasLineOfSight(source, Game.camera.position)) {
    return false;
  }

  return true;
}

// ============ INDOOR AI BEHAVIOR ============
// Indoor CQB bots behave differently than outdoor ones:
//  - Shorter engagement distances (tight corridors)
//  - Listen for gunfire (audio alert)
//  - Use cover-peeking (lean from behind walls)
//  - Move in patrols along corridors, check corners
//  - Faster reaction but worse at range
//  - Sometimes hold positions (camping)

function spawnIndoorEnemies() {
  const headMat = new THREE.MeshStandardMaterial({ color: 0xddaa88, roughness: 0.8 });

  // Indoor patrol waypoints — positioned in corridors and rooms
  const indoorPatrolPoints = [
    new THREE.Vector3(-30, 0, -30), new THREE.Vector3(-10, 0, -35),
    new THREE.Vector3(15, 0, -25), new THREE.Vector3(35, 0, -35),
    new THREE.Vector3(-35, 0, 0), new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(30, 0, -5), new THREE.Vector3(-20, 0, 20),
    new THREE.Vector3(10, 0, 30), new THREE.Vector3(35, 0, 25),
    new THREE.Vector3(-40, 0, 35), new THREE.Vector3(45, 0, 40),
    new THREE.Vector3(-25, 0, -15), new THREE.Vector3(20, 0, 15),
  ];

  for (let i = 0; i < INDOOR_MAX_ENEMIES; i++) {
    const group = new THREE.Group();

    // Body (darker gear for indoor CQB)
    const bodyGeo = new THREE.BoxGeometry(0.7, 1.3, 0.45);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x664433, roughness: 0.8 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.65;
    body.castShadow = true;
    group.add(body);

    // Helmet (indoor players usually wear helmets)
    const helmetGeo = new THREE.SphereGeometry(0.32, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.2 });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.y = 1.55;
    helmet.castShadow = true;
    group.add(helmet);

    // Face / goggles (mandatory in real indoor airsoft)
    const headGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.5;
    group.add(head);

    const goggleGeo = new THREE.BoxGeometry(0.35, 0.1, 0.15);
    const goggleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.6 });
    const goggles = new THREE.Mesh(goggleGeo, goggleMat);
    goggles.position.set(0, 1.55, -0.2);
    group.add(goggles);

    // Short CQB weapon (SMG style)
    const gunGeo = new THREE.BoxGeometry(0.05, 0.05, 0.4);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6 });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(0.3, 0.8, -0.25);
    group.add(gun);

    // Spawn at patrol waypoints spread apart
    const spawnPt = indoorPatrolPoints[i % indoorPatrolPoints.length];
    const offset = new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6);
    group.position.copy(spawnPt).add(offset);
    group.position.y = 0;
    Game.scene.add(group);

    // Physics body
    const shape = new CANNON.Sphere(0.6);
    const physBody = new CANNON.Body({ mass: 65, shape, linearDamping: 0.92 });
    physBody.position.set(group.position.x, 1, group.position.z);
    physBody.fixedRotation = true;
    Game.world.addBody(physBody);

    Game.enemies.push({
      mesh: group,
      body: physBody,
      health: 80,             // Less health indoors (lighter gear CQB)
      alive: true,
      fireTimer: 0,
      fireRate: 0.4 + Math.random() * 0.3,  // Faster firing in CQB
      damage: 8 + Math.random() * 6,         // Moderate damage
      speed: 3 + Math.random() * 2,          // Slightly slower (careful movement)
      state: 'patrol',
      patrolTarget: null,
      alertTimer: 0,
      team: 'bravo',
      name: 'CQB-' + (i + 1),
      // Indoor-specific AI fields
      indoor: true,
      patrolWaypoints: shuffleArray([...indoorPatrolPoints]),
      waypointIndex: 0,
      holdTimer: 0,          // Time spent holding a position
      holdDuration: 0,       // How long to hold
      peekSide: Math.random() > 0.5 ? 1 : -1, // Which side to peek from
      lastHeardShot: 0,      // Audio alert from gunfire
      isHolding: false,      // Camping / holding a position
      cornerCheckTimer: 0,   // Pause at corners
    });

    if (Game.darkMode) {
      addEnemyFlashlight(Game.enemies[Game.enemies.length - 1]);
    }
  }
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Indoor AI update — replaces updateEnemies for indoor map
function updateIndoorEnemies(dt) {
  const playerPos = Game.camera.position;

  Game.enemies.forEach((enemy, idx) => {
    if (!enemy.alive) {
      enemy.mesh.visible = false;
      return;
    }

    const ePos = enemy.mesh.position;
    const dist = ePos.distanceTo(playerPos);
    const dirToPlayer = new THREE.Vector3().subVectors(playerPos, ePos).normalize();

    // ---- DETECTION (shorter range indoors, but can "hear" shots) ----
    const detectRange = Game.darkMode ? 0 : 35; // Dark mode uses flashlight cone detection
    const hearRange = 50;   // Can hear gunfire further

    // Check if player recently fired (within last 2 seconds)
    const playerRecentlyFired = Game.weapon && Game.weapon.fireTimer > -0.5;

    if ((Game.darkMode && isPlayerInEnemyFlashlight(enemy)) || (dist < detectRange && Game.player.isAlive)) {
      enemy.state = 'engage';
      enemy.alertTimer = 6;
    } else if (!Game.darkMode && dist < hearRange && playerRecentlyFired && Game.player.isAlive) {
      // Heard gunfire — investigate
      enemy.state = 'investigate';
      enemy.alertTimer = 4;
      enemy.lastHeardShot = Game.clock.elapsedTime;
    } else if (enemy.alertTimer > 0) {
      enemy.alertTimer -= dt;
    } else {
      enemy.state = 'patrol';
    }

    // ---- STATE MACHINE ----
    switch (enemy.state) {
      case 'patrol':
        indoorPatrol(enemy, dt);
        break;
      case 'investigate':
        indoorInvestigate(enemy, playerPos, dt);
        break;
      case 'engage':
        indoorEngage(enemy, playerPos, dirToPlayer, dist, idx, dt);
        break;
      case 'hold':
        indoorHold(enemy, playerPos, dirToPlayer, dist, dt);
        break;
    }

    // ---- SYNC MESH TO PHYSICS ----
    enemy.mesh.position.x = enemy.body.position.x;
    enemy.mesh.position.z = enemy.body.position.z;
    enemy.mesh.position.y = enemy.body.position.y - 0.8;

    // Clamp to indoor bounds
    const bound = INDOOR_HALF - 2;
    enemy.body.position.x = Math.max(-bound, Math.min(bound, enemy.body.position.x));
    enemy.body.position.z = Math.max(-bound, Math.min(bound, enemy.body.position.z));
  });
}

function updateDarkMode(dt) {
  // Keep player headlamp stable and subtle while sprinting.
  if (!Game.darkMode || !darkModeData.playerFlashlight) return;
  const moveFactor = Game.player.isSprinting ? 0.08 : 0.03;
  darkModeData.playerFlashlight.intensity = 2.35 + Math.sin(Game.clock.elapsedTime * 10) * moveFactor;
}

function indoorPatrol(enemy, dt) {
  if (!enemy.patrolWaypoints || enemy.patrolWaypoints.length === 0) return;

  // Corner check: pause briefly when approaching a waypoint
  if (enemy.cornerCheckTimer > 0) {
    enemy.cornerCheckTimer -= dt;
    enemy.body.velocity.x *= 0.3;
    enemy.body.velocity.z *= 0.3;
    return;
  }

  const target = enemy.patrolWaypoints[enemy.waypointIndex];
  const ePos = enemy.mesh.position;
  const dist = new THREE.Vector2(ePos.x - target.x, ePos.z - target.z).length();

  if (dist < 3) {
    // Reached waypoint — pause to "check the corner"
    enemy.waypointIndex = (enemy.waypointIndex + 1) % enemy.patrolWaypoints.length;
    enemy.cornerCheckTimer = 0.8 + Math.random() * 1.0;

    // Randomly decide to hold position
    if (Math.random() < 0.2) {
      enemy.state = 'hold';
      enemy.holdDuration = 3 + Math.random() * 5;
      enemy.holdTimer = 0;
      return;
    }
    return;
  }

  // Move toward waypoint (slower, cautious)
  const moveDir = new THREE.Vector3(target.x - ePos.x, 0, target.z - ePos.z).normalize();
  enemy.body.velocity.x = moveDir.x * enemy.speed * 0.6;
  enemy.body.velocity.z = moveDir.z * enemy.speed * 0.6;
  enemy.mesh.rotation.y = Math.atan2(moveDir.x, moveDir.z);
}

function indoorInvestigate(enemy, playerPos, dt) {
  // Move toward last heard position (player's current position as proxy)
  const ePos = enemy.mesh.position;
  const dirToSound = new THREE.Vector3(playerPos.x - ePos.x, 0, playerPos.z - ePos.z).normalize();

  // Move cautiously toward sound
  enemy.body.velocity.x = dirToSound.x * enemy.speed * 0.5;
  enemy.body.velocity.z = dirToSound.z * enemy.speed * 0.5;
  enemy.mesh.rotation.y = Math.atan2(dirToSound.x, dirToSound.z);
}

function indoorEngage(enemy, playerPos, dirToPlayer, dist, idx, dt) {
  // Face the player
  enemy.mesh.rotation.y = Math.atan2(dirToPlayer.x, dirToPlayer.z);

  if (dist > 15) {
    // Advance toward player, using cover approach (slight zigzag)
    const zigzag = Math.sin(Game.clock.elapsedTime * 3 + idx * 2) * 0.4;
    const perpendicular = new THREE.Vector3(-dirToPlayer.z, 0, dirToPlayer.x);
    const moveDir = dirToPlayer.clone().add(perpendicular.multiplyScalar(zigzag)).normalize();
    enemy.body.velocity.x = moveDir.x * enemy.speed;
    enemy.body.velocity.z = moveDir.z * enemy.speed;
  } else if (dist > 5) {
    // Peek-and-strafe (CQB tactic: lean out, shoot, lean back)
    const strafeDir = new THREE.Vector3(-dirToPlayer.z, 0, dirToPlayer.x);
    const peekCycle = Math.sin(Game.clock.elapsedTime * 1.5 + idx);
    strafeDir.multiplyScalar(peekCycle * enemy.speed * 0.6 * enemy.peekSide);
    enemy.body.velocity.x = strafeDir.x;
    enemy.body.velocity.z = strafeDir.z;
  } else {
    // Too close — back up while firing
    enemy.body.velocity.x = -dirToPlayer.x * enemy.speed * 0.8;
    enemy.body.velocity.z = -dirToPlayer.z * enemy.speed * 0.8;
  }

  // Shoot
  enemy.fireTimer -= dt;
  if (enemy.fireTimer <= 0 && dist < 40 && Game.player.isAlive) {
    enemy.fireTimer = enemy.fireRate;
    indoorEnemyShoot(enemy, dirToPlayer.clone());
  }
}

function indoorHold(enemy, playerPos, dirToPlayer, dist, dt) {
  // Camping / holding position — stays still, watches
  enemy.body.velocity.x *= 0.1;
  enemy.body.velocity.z *= 0.1;

  enemy.holdTimer += dt;
  if (enemy.holdTimer >= enemy.holdDuration) {
    enemy.state = 'patrol';
    return;
  }

  // If player gets close while holding, engage immediately
  if (dist < 25 && Game.player.isAlive) {
    enemy.state = 'engage';
    enemy.alertTimer = 6;
    return;
  }

  // Slightly scan left-right while holding
  enemy.mesh.rotation.y += Math.sin(Game.clock.elapsedTime * 0.8) * dt * 0.5;
}

function indoorEnemyShoot(enemy, dir) {
  const ePos = enemy.mesh.position.clone();
  ePos.y += 1.1;

  // Indoor accuracy — better at close range (CQB training)
  const spread = 0.1;
  dir.x += (Math.random() - 0.5) * spread;
  dir.y += (Math.random() - 0.5) * spread * 0.5;
  dir.z += (Math.random() - 0.5) * spread;
  dir.normalize();

  const bbGeo = new THREE.SphereGeometry(0.05, 4, 4);
  const bbMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
  const bbMesh = new THREE.Mesh(bbGeo, bbMat);
  bbMesh.position.copy(ePos);
  Game.scene.add(bbMesh);

  Game.bbs.push({
    mesh: bbMesh,
    velocity: dir.multiplyScalar(BB_SPEED * 0.7), // Slower indoor FPS limit
    life: 1.5,                                     // Short range indoors
    damage: enemy.damage,
    owner: 'enemy'
  });
}

// ============ INDOOR ENEMY HIT/RESPAWN ============
function hitIndoorEnemy(index, damage) {
  const enemy = Game.enemies[index];
  enemy.health -= damage;
  enemy.alertTimer = 8;

  // Flash hit
  const origColor = enemy.mesh.children[0].material.color.getHex();
  enemy.mesh.children[0].material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  setTimeout(() => {
    if (enemy.alive) {
      enemy.mesh.children[0].material = new THREE.MeshStandardMaterial({ color: 0x664433, roughness: 0.8 });
    }
  }, 100);

  if (enemy.health <= 0) {
    enemy.alive = false;
    enemy.mesh.visible = false;
    Game.player.kills++;
    Game.player.score += 150;  // More points for CQB kills
    Game.player.xp += 75;
    addKillFeedEntry('You', enemy.name);
    showNotification('+150 CQB Kill');

    // Respawn at a random patrol waypoint after delay
    setTimeout(() => {
      if (!Game.active) return;
      enemy.health = 80;
      enemy.alive = true;
      enemy.mesh.visible = true;
      enemy.state = 'patrol';

      // Pick a spawn point far from player
      const pts = enemy.patrolWaypoints;
      let bestPt = pts[0];
      let bestDist = 0;
      pts.forEach(pt => {
        const d = pt.distanceTo(Game.camera.position);
        if (d > bestDist) { bestDist = d; bestPt = pt; }
      });
      enemy.body.position.set(bestPt.x, 2, bestPt.z);
    }, RESPAWN_TIME * 1000 + 1000); // Extra second for indoor
  }
}

// ============ INDOOR POWER-UP SPAWNS ============
// Ammo crates and water bottles (real airsoft has water/snack stations)
function spawnIndoorPowerUps() {
  const types = [
    { type: 'ammo', color: 0x44ff44, label: 'AMMO CRATE' },
    { type: 'health', color: 0xff4444, label: 'FIRST AID' },
    { type: 'speed', color: 0x44aaff, label: 'ENERGY DRINK' },
    { type: 'shield', color: 0xffaa00, label: 'PLATE INSERT' },
  ];

  // Indoor power-up positions (in corridors and rooms)
  const positions = [
    [-25, -25], [0, -30], [25, -20], [-30, 5],
    [0, 0], [30, 0], [-20, 25], [10, 35],
  ];

  positions.forEach(([x, z], i) => {
    const t = types[i % types.length];
    const group = new THREE.Group();

    if (t.type === 'ammo') {
      // Ammo crate appearance
      const boxGeo = new THREE.BoxGeometry(0.8, 0.5, 0.5);
      const boxMat = new THREE.MeshStandardMaterial({
        color: 0x556B2F, roughness: 0.8,
        emissive: t.color, emissiveIntensity: 0.15
      });
      group.add(new THREE.Mesh(boxGeo, boxMat));
    } else {
      // Standard power-up cube
      const boxGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
      const boxMat = new THREE.MeshStandardMaterial({
        color: t.color, transparent: true, opacity: 0.7,
        emissive: t.color, emissiveIntensity: 0.3
      });
      group.add(new THREE.Mesh(boxGeo, boxMat));
    }

    group.position.set(x, 0.8, z);
    Game.scene.add(group);

    Game.powerUps.push({
      mesh: group,
      type: t.type,
      label: t.label,
      active: true,
      respawnTimer: 0
    });
  });
}

// ============ INDOOR PLAYER SPAWN ============
function getIndoorSpawnPosition() {
  // Spawn player in alpha spawn zone (southwest corner)
  return new THREE.Vector3(
    -INDOOR_HALF + 10 + (Math.random() - 0.5) * 8,
    2,
    -INDOOR_HALF + 10 + (Math.random() - 0.5) * 8
  );
}

// ============ INDOOR GAME RULES ============
// Adjustments for indoor play:
const IndoorRules = {
  bbSpeedMultiplier: 0.75,    // Lower FPS indoors
  bbDropMultiplier: 0.6,      // Less drop (shorter distances)
  bbLifetime: 1.5,            // BBs don't travel far indoors
  maxEngageRange: 50,         // Max meaningful range

  // No weather effects indoors
  noWeather: true,

  // No wind indoors
  noWind: true,

  // Shorter match time for intense CQB
  matchTime: 240,  // 4 minutes

  // "Bang bang" rule — very close range auto-elimination
  bangBangRange: 2.5,

  // Apply indoor rules to the game state
  apply() {
    Game.wind.x = 0;
    Game.wind.z = 0;
    Game.wind.strength = 0;
    Game.matchTimer = this.matchTime;
  },

  // Check bang-bang rule during gameplay
  checkBangBang(dt) {
    Game.enemies.forEach((enemy, idx) => {
      if (!enemy.alive || !Game.player.isAlive) return;
      const dist = enemy.mesh.position.distanceTo(Game.camera.position);
      if (dist < this.bangBangRange) {
        if (Game.weapon && Game.weapon.fireTimer > 0) {
          damagePlayer(30);
          showNotification('BANG BANG! Too close!');
          const dir = new THREE.Vector3().subVectors(enemy.mesh.position, Game.camera.position).normalize();
          enemy.body.velocity.x = dir.x * 8;
          enemy.body.velocity.z = dir.z * 8;
        }
      }
    });
  }
};

// ============ INDOOR RESPAWN ============
function respawnIndoorPlayer() {
  Game.player.isAlive = true;
  Game.player.health = 100;
  const spawnPos = getIndoorSpawnPosition();
  Game.player.body.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
  Game.player.body.velocity.set(0, 0, 0);
  showNotification('Respawned at base!');
}

// ============ INDOOR MINIMAP ============
function updateIndoorMinimap() {
  const ctx = Game.minimapCtx;
  if (!ctx) return;

  // Indoor minimap is intentionally throttled to reduce per-frame UI work.
  const now = performance.now();
  if (now - indoorMinimapLastUpdateMs < 80) return;
  indoorMinimapLastUpdateMs = now;

  const size = 160;
  const scale = size / INDOOR_SIZE;

  ctx.clearRect(0, 0, size, size);

  // Dark indoor background
  ctx.fillStyle = 'rgba(20, 20, 25, 0.9)';
  ctx.fillRect(0, 0, size, size);

  // Outer walls
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  // Grid
  ctx.strokeStyle = 'rgba(60, 60, 60, 0.3)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < size; i += 20) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }

  // Spawn zones
  ctx.fillStyle = 'rgba(68, 136, 255, 0.2)';
  const spawnSize = 14 * scale;
  ctx.fillRect(
    ((-INDOOR_HALF + 10) + INDOOR_HALF) * scale - spawnSize / 2,
    ((-INDOOR_HALF + 10) + INDOOR_HALF) * scale - spawnSize / 2,
    spawnSize, spawnSize
  );
  ctx.fillStyle = 'rgba(255, 68, 68, 0.2)';
  ctx.fillRect(
    ((INDOOR_HALF - 10) + INDOOR_HALF) * scale - spawnSize / 2,
    ((INDOOR_HALF - 10) + INDOOR_HALF) * scale - spawnSize / 2,
    spawnSize, spawnSize
  );

  // Enemies (red dots)
  ctx.fillStyle = '#ff3333';
  Game.enemies.forEach(e => {
    if (!e.alive) return;
    const mx = (e.mesh.position.x + INDOOR_HALF) * scale;
    const mz = (e.mesh.position.z + INDOOR_HALF) * scale;
    ctx.beginPath();
    ctx.arc(mx, mz, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Player (green arrow)
  const px = (Game.camera.position.x + INDOOR_HALF) * scale;
  const pz = (Game.camera.position.z + INDOOR_HALF) * scale;
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(-Game.yaw);
  ctx.fillStyle = '#44ff44';
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(-3, 4);
  ctx.lineTo(3, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}