import * as THREE from 'three';
import {
  clamp,
  distance4,
  type Orientation4D,
  type Projection3D,
  type Vec4,
  vec4,
} from './engine/math4d.ts';
import {
  computePhaseAppearance,
  projectRenderablePoint,
} from './engine/render4d.ts';
import {
  createEntities,
  type EntitySnapshot,
} from './engine/entities.ts';
import { VoxelWorld4D } from './engine/world4d.ts';
import {
  loadSceneAssets,
  type SceneAsset,
} from './engine/assets.ts';

type GameAppOptions = {
  canvas: HTMLCanvasElement;
  controlsElement: HTMLDivElement;
  entityElement: HTMLDivElement;
  pointerLockButton: HTMLButtonElement;
  statusElement: HTMLDivElement;
};

type PlayerState = {
  orientation: Orientation4D;
  position4: Vec4;
  projectionDistance: number;
};

class InputController {
  private readonly keys = new Set<string>();
  private accumulatedLookX = 0;
  private accumulatedLookY = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly pointerLockButton: HTMLButtonElement,
  ) {
    this.canvas.addEventListener('click', () => {
      void this.canvas.requestPointerLock();
    });

    this.pointerLockButton.addEventListener('click', () => {
      void this.canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLockButton.textContent =
        document.pointerLockElement === this.canvas
          ? 'Pointer Locked'
          : 'Click To Look Around';
    });

    window.addEventListener('keydown', (event) => {
      if (this.isHandledKey(event.code)) {
        event.preventDefault();
      }

      this.keys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      if (this.isHandledKey(event.code)) {
        event.preventDefault();
      }

      this.keys.delete(event.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.accumulatedLookX = 0;
      this.accumulatedLookY = 0;
    });

    document.addEventListener('mousemove', (event) => {
      if (document.pointerLockElement !== this.canvas) {
        return;
      }

      this.accumulatedLookX += event.movementX;
      this.accumulatedLookY += event.movementY;
    });
  }

  consumeLookDelta(): { x: number; y: number } {
    const delta = {
      x: this.accumulatedLookX,
      y: this.accumulatedLookY,
    };

    this.accumulatedLookX = 0;
    this.accumulatedLookY = 0;

    return delta;
  }

  isPressed(code: string): boolean {
    return this.keys.has(code);
  }

  private isHandledKey(code: string): boolean {
    return [
      'BracketLeft',
      'BracketRight',
      'KeyC',
      'KeyE',
      'KeyI',
      'KeyJ',
      'KeyK',
      'KeyL',
      'KeyO',
      'KeyQ',
      'KeyU',
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'ShiftLeft',
      'ShiftRight',
      'Space',
    ].includes(code);
  }
}

export class GameApp {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly world = new VoxelWorld4D(7);
  private readonly entities = createEntities(this.world);
  private readonly input: InputController;
  private lastFrameTime = performance.now();
  private readonly player: PlayerState = {
    orientation: {
      pitch: -0.08,
      xw: 0.14,
      yaw: 0,
      yw: -0.16,
      zw: 0.28,
    },
    position4: vec4(0, 6.1, 34, 0),
    projectionDistance: 10.2,
  };
  private readonly statusRows: string[] = [];
  private readonly entityRows: string[] = [];
  private readonly controlsMarkup = `
    <div class="control-list">
      <span><code>W A S D</code> drift through the hull</span>
      <span><code>Space / C</code> rise · descend</span>
      <span><code>Shift</code> accelerate</span>
      <span><code>Mouse</code> look</span>
      <span><code>Q / E</code> shift along w</span>
      <span><code>I K · J L · U O</code> rotate 4D planes</span>
      <span><code>[ / ]</code> adjust lens</span>
    </div>
  `;
  private elapsed = 0;
  private lastHudUpdate = 0;
  private phaseMotes: Vec4[] = [];
  private phaseMotePoints: THREE.Points | null = null;
  private sceneAssets: SceneAsset[] = [];

  constructor(private readonly options: GameAppOptions) {
    this.options.controlsElement.innerHTML = this.controlsMarkup;
    this.input = new InputController(options.canvas, options.pointerLockButton);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: options.canvas,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor('#020408');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#020408', 0.008);

    this.camera = new THREE.PerspectiveCamera(
      72,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );
    this.camera.position.set(0, 0, 0);

    this.configureScene();
    this.configurePhaseMotes();

    window.addEventListener('resize', this.handleResize);
  }

  start(): void {
    this.renderer.setAnimationLoop(this.tick);
    this.loadAssets();
  }

  private loadAssets(): void {
    loadSceneAssets().then((assets) => {
      this.sceneAssets = assets;
      for (const asset of assets) {
        if (asset.model) {
          asset.model.visible = false;
          this.scene.add(asset.model);
        }
      }
    });
  }

  private readonly tick = () => {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;
    this.elapsed += dt;

    this.updatePlayer(dt);
    this.updateEntities(dt);
    this.renderSceneAssets();
    this.renderPhaseMotes();
    this.updateHud();

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = -this.player.orientation.yaw;
    this.camera.rotation.x = this.player.orientation.pitch;

    this.renderer.render(this.scene, this.camera);
  };

  private readonly handleResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  };

  private configureScene(): void {
    const ambient = new THREE.HemisphereLight('#c8d8f8', '#0a0e18', 0.9);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight('#b8d0f0', 0.6);
    keyLight.position.set(8, 10, 14);
    this.scene.add(keyLight);

    const lumenGlow1 = new THREE.PointLight('#60d8ff', 35, 60, 2);
    lumenGlow1.position.set(0, 6, 0);
    this.scene.add(lumenGlow1);

    const lumenGlow2 = new THREE.PointLight('#80e0ff', 20, 50, 2);
    lumenGlow2.position.set(-4, 4, -8);
    this.scene.add(lumenGlow2);

    const lumenGlow3 = new THREE.PointLight('#40c8ff', 15, 45, 2);
    lumenGlow3.position.set(5, 8, 6);
    this.scene.add(lumenGlow3);

    const warmLight = new THREE.PointLight('#ffb090', 18, 40, 2);
    warmLight.position.set(-5, 5, -4);
    this.scene.add(warmLight);

    const haze = new THREE.BufferGeometry();
    const hazePositions = new Float32Array(1200 * 3);

    for (let index = 0; index < 1200; index += 1) {
      const stride = index * 3;
      hazePositions[stride] = (Math.random() - 0.5) * 220;
      hazePositions[stride + 1] = (Math.random() - 0.5) * 140;
      hazePositions[stride + 2] = -Math.random() * 200 - 10;
    }

    haze.setAttribute('position', new THREE.BufferAttribute(hazePositions, 3));

    const hazeMaterial = new THREE.PointsMaterial({
      color: '#4080d0',
      opacity: 0.18,
      size: 0.15,
      transparent: true,
    });

    const hazeField = new THREE.Points(haze, hazeMaterial);
    this.scene.add(hazeField);
  }

  private configurePhaseMotes(): void {
    this.phaseMotes = [];

    for (let i = 0; i < 300; i += 1) {
      this.phaseMotes.push(
        vec4(
          (Math.random() - 0.5) * 40,
          Math.random() * 14 + 1,
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 8,
        ),
      );
    }

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.phaseMotes.length * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: '#90d8ff',
      opacity: 0.5,
      size: 0.12,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.phaseMotePoints = new THREE.Points(geometry, material);
    this.phaseMotePoints.frustumCulled = false;
    this.scene.add(this.phaseMotePoints);
  }

  private renderPhaseMotes(): void {
    if (!this.phaseMotePoints) return;

    const positions = this.phaseMotePoints.geometry.attributes.position as THREE.BufferAttribute;
    let visible = 0;

    for (const mote of this.phaseMotes) {
      const projected = this.projectPoint(mote);
      if (!projected) continue;

      const phase = computePhaseAppearance(projected.localW);
      if (phase.ghostAlpha < 0.05) continue;

      positions.setXYZ(visible, projected.x, projected.y, projected.z);
      visible += 1;
    }

    this.phaseMotePoints.geometry.setDrawRange(0, visible);
    positions.needsUpdate = true;
  }

  private renderSceneAssets(): void {
    for (const asset of this.sceneAssets) {
      if (!asset.model) continue;

      const projected = this.projectPoint(asset.position4);

      if (!projected) {
        asset.model.visible = false;
        continue;
      }

      const phase = computePhaseAppearance(projected.localW);

      if (phase.ghostAlpha < 0.02) {
        asset.model.visible = false;
        continue;
      }

      asset.model.visible = true;
      asset.model.position.set(projected.x, projected.y, projected.z);

      const s = asset.scale * projected.scale * phase.phaseScale;
      asset.model.scale.setScalar(s);

      asset.model.rotation.copy(asset.rotation);
      asset.model.rotation.y += this.elapsed * 0.015;

      const targetOpacity = asset.opacity * phase.ghostAlpha;
      asset.model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const mat of materials) {
            if (mat instanceof THREE.MeshStandardMaterial) {
              mat.opacity = targetOpacity;
            }
          }
        }
      });
    }
  }

  private updatePlayer(dt: number): void {
    const look = this.input.consumeLookDelta();
    this.player.orientation.yaw -= look.x * 0.0024;
    this.player.orientation.pitch = clamp(
      this.player.orientation.pitch - look.y * 0.0022,
      -1.45,
      1.45,
    );

    const boost = this.input.isPressed('ShiftLeft') || this.input.isPressed('ShiftRight');
    const moveSpeed = boost ? 12 : 6;
    const verticalSpeed = boost ? 9 : 4.5;
    const wSpeed = boost ? 2.8 : 1.6;
    const rotationSpeed = 0.6;
    const lensSpeed = 4;

    const forward = new THREE.Vector3(
      Math.sin(this.player.orientation.yaw),
      0,
      -Math.cos(this.player.orientation.yaw),
    );
    const right = new THREE.Vector3(
      Math.cos(this.player.orientation.yaw),
      0,
      Math.sin(this.player.orientation.yaw),
    );

    if (this.input.isPressed('KeyW')) {
      this.player.position4.x += forward.x * moveSpeed * dt;
      this.player.position4.z += forward.z * moveSpeed * dt;
    }

    if (this.input.isPressed('KeyS')) {
      this.player.position4.x -= forward.x * moveSpeed * dt;
      this.player.position4.z -= forward.z * moveSpeed * dt;
    }

    if (this.input.isPressed('KeyA')) {
      this.player.position4.x -= right.x * moveSpeed * dt;
      this.player.position4.z -= right.z * moveSpeed * dt;
    }

    if (this.input.isPressed('KeyD')) {
      this.player.position4.x += right.x * moveSpeed * dt;
      this.player.position4.z += right.z * moveSpeed * dt;
    }

    if (this.input.isPressed('Space')) {
      this.player.position4.y += verticalSpeed * dt;
    }

    if (this.input.isPressed('KeyC')) {
      this.player.position4.y -= verticalSpeed * dt;
    }

    if (this.input.isPressed('KeyQ')) {
      this.player.position4.w -= wSpeed * dt;
    }

    if (this.input.isPressed('KeyE')) {
      this.player.position4.w += wSpeed * dt;
    }

    if (this.input.isPressed('KeyI')) {
      this.player.orientation.xw += rotationSpeed * dt;
    }

    if (this.input.isPressed('KeyK')) {
      this.player.orientation.xw -= rotationSpeed * dt;
    }

    if (this.input.isPressed('KeyJ')) {
      this.player.orientation.yw += rotationSpeed * dt;
    }

    if (this.input.isPressed('KeyL')) {
      this.player.orientation.yw -= rotationSpeed * dt;
    }

    if (this.input.isPressed('KeyU')) {
      this.player.orientation.zw += rotationSpeed * dt;
    }

    if (this.input.isPressed('KeyO')) {
      this.player.orientation.zw -= rotationSpeed * dt;
    }

    if (this.input.isPressed('BracketLeft')) {
      this.player.projectionDistance = clamp(
        this.player.projectionDistance - lensSpeed * dt,
        5.2,
        16,
      );
    }

    if (this.input.isPressed('BracketRight')) {
      this.player.projectionDistance = clamp(
        this.player.projectionDistance + lensSpeed * dt,
        5.2,
        16,
      );
    }
  }

  private updateEntities(dt: number): void {
    for (const entity of this.entities) {
      entity.update(dt, this.elapsed, this.world);
    }
  }

  private projectPoint(point: Vec4): Projection3D | null {
    return projectRenderablePoint(point, this.player);
  }

  private updateHud(): void {
    if (this.elapsed - this.lastHudUpdate < 0.1) {
      return;
    }

    this.lastHudUpdate = this.elapsed;
    this.statusRows.length = 0;
    this.entityRows.length = 0;

    this.statusRows.push(this.renderMetric('w-axis', this.player.position4.w.toFixed(2)));
    this.statusRows.push(this.renderMetric('lens', this.player.projectionDistance.toFixed(1)));

    const nearest = this.findNearestEntity();

    if (nearest) {
      this.entityRows.push(
        this.renderMetric(
          'nearest',
          `${nearest.label} · ${distance4(nearest.position4, this.player.position4).toFixed(1)}u`,
        ),
      );
    }

    this.options.statusElement.innerHTML = this.statusRows.join('');
    this.options.entityElement.innerHTML = this.entityRows.join('');
  }

  private renderMetric(label: string, value: string): string {
    return `
      <div class="metric">
        <span class="metric-label">${label}</span>
        <span class="metric-value">${value}</span>
      </div>
    `;
  }

  private findNearestEntity(): EntitySnapshot | null {
    let nearest: EntitySnapshot | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const entity of this.entities) {
      const snapshot = entity.snapshot();
      const distance = distance4(snapshot.position4, this.player.position4);

      if (distance < nearestDistance) {
        nearest = snapshot;
        nearestDistance = distance;
      }
    }

    return nearest;
  }
}
