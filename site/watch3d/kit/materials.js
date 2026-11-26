// Finishes. Steel comes in two kinds that must read as different at a glance:
//   polished - a near-mirror that shows the studio lamps with hard edges
//   brushed  - a satin with a visible grain, whose highlight smears across the grain
// Brushed parts carry UVs in mm / BRUSH_TILE with U running along the grain.
import * as THREE from '../vendor/three.module.js';
import { rng } from './geo.js';

// Only the colours of the shared materials below; a watch's own colours (its dial, its print) live in its folder.
export const COLORS = {
  steel: 0xc9cbce,
  rhodium: 0xdfe1e4,
  ink: 0x15171b,
  red: 0xc8201c,
  lume: 0xf1f0df,
};

/** Tileable maps of fine scratches running along U: a normal map and a grey "sheen" map. */
function brushMaps(size = 512, seed = 7) {
  const r = rng(seed);
  const h = new Float32Array(size * size);
  const streaks = size * 70;
  for (let n = 0; n < streaks; n++) {
    const y = (r() * size) | 0, x0 = (r() * size) | 0;
    const len = ((0.12 + r() * r() * 0.88) * size) | 0;
    const a = (r() - 0.5) * (0.4 + r());
    for (let k = 0; k < len; k++) {
      const w = Math.sin(Math.PI * k / len);
      h[y * size + ((x0 + k) % size)] += a * w;
    }
  }
  const nrm = new Uint8Array(size * size * 4);
  const col = new Uint8Array(size * size * 4);
  const H = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 0.25;
      const dy = (H(x, y + 1) - H(x, y - 1)) * 0.5;
      const l = Math.hypot(dx, dy, 1);
      const k = (y * size + x) * 4;
      nrm[k] = (-dx / l * 0.5 + 0.5) * 255;
      nrm[k + 1] = (-dy / l * 0.5 + 0.5) * 255;
      nrm[k + 2] = (1 / l * 0.5 + 0.5) * 255;
      nrm[k + 3] = 255;
      const g = Math.max(0, Math.min(1, 0.875 + H(x, y) * 0.085)) * 255;
      col[k] = col[k + 1] = col[k + 2] = g; col[k + 3] = 255;
    }
  }
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { normal: tex(nrm, false), color: tex(col, true) };
}

export function makeMaterials(renderer) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const { normal: brushN, color: brushC } = brushMaps();
  brushN.anisotropy = brushC.anisotropy = maxAniso;

  const M = { maxAniso, brushN, brushC };

  M.polished = new THREE.MeshPhysicalMaterial({ color: COLORS.steel, metalness: 1, roughness: 0.055 });

  // Grain runs along U; the highlight is stretched across it, hence the quarter-turn.
  M.brushed = new THREE.MeshPhysicalMaterial({
    color: COLORS.steel, metalness: 1, roughness: 0.36,
    anisotropy: 0.8, anisotropyRotation: Math.PI / 2,
    map: brushC, normalMap: brushN, normalScale: new THREE.Vector2(0.6, 0.6),
  });
  // Same finish with vertex-colour shading, for parts that fake occlusion in their grooves.
  M.polishedAO = M.polished.clone(); M.polishedAO.vertexColors = true;
  M.brushedAO = M.brushed.clone(); M.brushedAO.vertexColors = true;

  // Finer satin for the clasp blades and small hardware.
  M.satin = new THREE.MeshPhysicalMaterial({
    color: COLORS.steel, metalness: 1, roughness: 0.27,
    anisotropy: 0.6, anisotropyRotation: Math.PI / 2,
    map: brushC, normalMap: brushN, normalScale: new THREE.Vector2(0.32, 0.32),
  });

  // Rhodium-plated dial furniture and hands: whiter and cleaner than the case steel.
  M.rhodium = new THREE.MeshPhysicalMaterial({ color: COLORS.rhodium, metalness: 1, roughness: 0.045 });

  M.lume = new THREE.MeshStandardMaterial({ color: COLORS.lume, metalness: 0, roughness: 0.62 });
  M.red = new THREE.MeshPhysicalMaterial({ color: COLORS.red, metalness: 0, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.3 });
  M.ink = new THREE.MeshStandardMaterial({ color: COLORS.ink, metalness: 0, roughness: 0.5 });
  M.gasket = new THREE.MeshStandardMaterial({ color: 0x08090a, metalness: 0, roughness: 0.8 });
  M.dark = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, metalness: 0.6, roughness: 0.5 });
  // The bezel's inner wall, seen through the edge of the crystal: steel in shadow.
  M.rehaut = new THREE.MeshPhysicalMaterial({ color: 0x8f9499, metalness: 1, roughness: 0.22, envMapIntensity: 0.7 });

  // Sapphire: the dial is drawn crisp underneath and the crystal only adds its reflections on top
  // (additive), with the weak, blue-tinted return of an anti-reflective coating.
  M.crystal = new THREE.MeshPhysicalMaterial({
    color: 0x000000, metalness: 0, roughness: 0.0, ior: 1.77,
    specularIntensity: 0.2, specularColor: new THREE.Color(0.72, 0.84, 1.0),
    envMapIntensity: 1.0,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  M.crystalInner = M.crystal.clone();
  M.crystalInner.side = THREE.BackSide;
  M.crystalInner.specularIntensity = 0.09;

  return M;
}
