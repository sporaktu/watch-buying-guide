// A photo studio to reflect: dark walls, a few bright soft boxes and strip lights with hard edges.
// Polished steel is only as convincing as what it mirrors, so the lamps are given crisp shapes
// and strong contrast against the room.
import * as THREE from '../vendor/three.module.js';

function panel(scene, { pos, size, power, color = 0xffffff, lookAt = [0, 0, 0] }) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false });
  m.color.multiplyScalar(power);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), m);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.lookAt(lookAt[0], lookAt[1], lookAt[2]);
  scene.add(mesh);
  return mesh;
}

export function buildStudio() {
  const scene = new THREE.Scene();

  // Room: a big inverted sphere with a soft vertical gradient.
  const g = new THREE.SphereGeometry(60, 48, 32);
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < g.attributes.position.count; i++) {
    const y = g.attributes.position.getY(i) / 60;
    const t = (y + 1) / 2;
    // never black: a polished part that mirrors only the room should still read as steel
    const v = 0.07 + 0.2 * Math.pow(t, 1.5);
    col[i * 3] = v * 0.96; col[i * 3 + 1] = v * 0.98; col[i * 3 + 2] = v * 1.06;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, toneMapped: false })));

  // Key soft box: front, above, to the left.
  panel(scene, { pos: [-14, 17, 20], size: [15, 15], power: 8.5, color: 0xfff6ea });
  // Overhead bank.
  panel(scene, { pos: [2, 30, 3], size: [30, 20], power: 4.2 });
  // Tall strip, front right: gives the long vertical streak on polished edges.
  panel(scene, { pos: [24, 5, 13], size: [3.2, 30], power: 9, color: 0xeef4ff });
  // Narrow strip, left: second edge light.
  panel(scene, { pos: [-27, 2, 2], size: [2.4, 26], power: 7 });
  // Back lights so the case back and clasp are not a black hole.
  panel(scene, { pos: [-12, 12, -24], size: [14, 12], power: 9, color: 0xf2f6ff });
  panel(scene, { pos: [18, -2, -22], size: [4, 26], power: 8 });
  // Low front fill and a floor bounce.
  panel(scene, { pos: [6, -16, 24], size: [22, 8], power: 2.2 });
  panel(scene, { pos: [0, -32, 0], size: [44, 44], power: 0.8, color: 0xdfe4ee });
  // Broad, dim side walls: something pale for the bracelet's flanks and the far side of the loop.
  panel(scene, { pos: [40, 4, -4], size: [36, 30], power: 0.62 });
  panel(scene, { pos: [-40, 6, -8], size: [36, 30], power: 0.5, color: 0xf3f0ea });
  panel(scene, { pos: [0, 6, -42], size: [50, 30], power: 0.55, color: 0xe9eef6 });
  panel(scene, { pos: [0, 8, 46], size: [60, 38], power: 0.7, color: 0xf1f3f6 });
  // Black flags: dark shapes for the bright ones to play against.
  panel(scene, { pos: [9, 22, 16], size: [9, 6], power: 0.0 });
  panel(scene, { pos: [-22, -10, 14], size: [8, 14], power: 0.0 });
  return scene;
}

export function makeEnvironment(renderer, size = 512) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = buildStudio();
  const rt = pmrem.fromScene(studio, 0, 0.1, 200, { size });
  pmrem.dispose();
  studio.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt.texture;
}

/** Screen-space backdrop: a dark neutral vignette, slightly lifted behind the watch. */
export function makeBackdrop() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(512, 470, 40, 512, 512, 760);
  g.addColorStop(0, '#3b4047');
  g.addColorStop(0.45, '#23262b');
  g.addColorStop(1, '#0c0d10');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
