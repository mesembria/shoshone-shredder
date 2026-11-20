// Mesh helpers shared by the rider rig and the bike's kit (fork, rear end, shock, brakes).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mat } from '../look/toyLook';

export const UP = new THREE.Vector3(0, 1, 0);
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function rodGeo(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 8): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, dir.length(), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
  const mid = a.clone().addScaledVector(dir, 0.5);
  return g.translate(mid.x, mid.y, mid.z);
}
export const roundBox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 2, r);

// Static pieces that share a color merge into one mesh, to keep draw calls low on the iPad.
// RoundedBoxGeometry has no index while the built-in shapes do, so merge everything unindexed.
export function piece(parent: THREE.Object3D, geos: THREE.BufferGeometry[], color: number): THREE.Mesh {
  const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));
  const m = new THREE.Mesh(geo, mat(color));
  m.castShadow = true;
  parent.add(m);
  return m;
}
