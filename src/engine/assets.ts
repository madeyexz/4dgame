import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { type Vec4, vec4 } from './math4d.ts';

export type SceneAsset = {
  id: string;
  position4: Vec4;
  scale: number;
  rotation: THREE.Euler;
  model: THREE.Group | null;
  opacity: number;
};

type AssetManifestEntry = {
  id: string;
  url: string;
  position4: Vec4;
  scale: number;
  rotation: [number, number, number];
  opacity: number;
};

const ASSET_MANIFEST: AssetManifestEntry[] = [
  {
    id: 'airship-hull',
    url: 'https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/aero-system/Aero_Airship_01.glb',
    position4: vec4(0, 5, 20, 0),
    scale: 3,
    rotation: [0, Math.PI * 0.5, 0],
    opacity: 0.7,
  },
  {
    id: 'airship-ghost-1',
    url: 'https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/aero-system/Aero_Airship_01.glb',
    position4: vec4(20, 8, 10, 3.5),
    scale: 2,
    rotation: [0.1, Math.PI * 0.8, 0.05],
    opacity: 0.35,
  },
  {
    id: 'airship-ghost-2',
    url: 'https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/aero-system/Aero_Airship_01.glb',
    position4: vec4(-18, 3, 30, -3.0),
    scale: 1.8,
    rotation: [0, Math.PI * 1.2, -0.08],
    opacity: 0.3,
  },
  {
    id: 'station-distant',
    url: 'https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/aero-system/Aero_Station_01_Art.glb',
    position4: vec4(30, 10, -10, 2.0),
    scale: 2.5,
    rotation: [0, 0.4, 0],
    opacity: 0.25,
  },
  {
    id: 'ring-structure',
    url: 'https://raw.githubusercontent.com/ToxSam/cc0-models-Polygonal-Mind/main/projects/aero-system/Aero_Station_Ring_Art.glb',
    position4: vec4(-20, 6, 40, -2.0),
    scale: 2,
    rotation: [0.3, 0, 0.1],
    opacity: 0.2,
  },
];

const loader = new GLTFLoader();

function makeGhostly(object: THREE.Object3D, baseOpacity: number): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
          mat.transparent = true;
          mat.opacity = baseOpacity;
          mat.depthWrite = false;
          mat.side = THREE.DoubleSide;
          const baseColor = mat.color.clone();
          mat.emissive = baseColor.multiplyScalar(0.5);
          mat.emissiveIntensity = 0.6;
        }
      }
    }
  });
}

export async function loadSceneAssets(): Promise<SceneAsset[]> {
  const assets: SceneAsset[] = [];

  const loadPromises = ASSET_MANIFEST.map(async (entry) => {
    try {
      const gltf = await loader.loadAsync(entry.url);
      const model = gltf.scene;
      makeGhostly(model, entry.opacity);

      assets.push({
        id: entry.id,
        position4: entry.position4,
        scale: entry.scale,
        rotation: new THREE.Euler(...entry.rotation),
        model,
        opacity: entry.opacity,
      });
    } catch {
      assets.push({
        id: entry.id,
        position4: entry.position4,
        scale: entry.scale,
        rotation: new THREE.Euler(...entry.rotation),
        model: null,
        opacity: entry.opacity,
      });
    }
  });

  await Promise.all(loadPromises);

  return assets;
}
