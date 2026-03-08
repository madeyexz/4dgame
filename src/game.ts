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
  computeBlockBrightness,
  projectRenderablePoint,
} from './engine/render4d.ts';
import {
  createEntities,
  type EntitySnapshot,
} from './engine/entities.ts';
import {
  BlockMaterial,
  MATERIAL_DEFS,
  VoxelWorld4D,
} from './engine/world4d.ts';

type BlockMeshState = {
  capacity: number;
  mesh: THREE.InstancedMesh;
  tint: THREE.Color;
};

type EntityView = {
  line: THREE.Line;
  mesh: THREE.Mesh;
};

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
      'ControlLeft',
      'ControlRight',
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
  private readonly blockMeshes = new Map<BlockMaterial, BlockMeshState>();
  private readonly entityViews = new Map<string, EntityView>();
  private lastFrameTime = performance.now();
  private readonly player: PlayerState = {
    orientation: {
      pitch: -0.18,
      xw: 0.16,
      yaw: 0,
      yw: -0.12,
      zw: 0.22,
    },
    position4: vec4(0, 8.5, 28, 0),
    projectionDistance: 9.5,
  };
  private readonly workingColor = new THREE.Color();
  private readonly workingMatrix = new THREE.Matrix4();
  private readonly workingQuaternion = new THREE.Quaternion();
  private readonly workingScale = new THREE.Vector3();
  private readonly statusRows: string[] = [];
  private readonly entityRows: string[] = [];
  private readonly controlsMarkup = `
    <div class="control-list">
      <span><code>W A S D</code> drift through x/z</span>
      <span><code>Space</code> rise</span>
      <span><code>C</code> descend</span>
      <span><code>Shift</code> accelerate</span>
      <span><code>Mouse</code> look around</span>
      <span><code>Q / E</code> move along w</span>
      <span><code>I / K</code> rotate xw</span>
      <span><code>J / L</code> rotate yw</span>
      <span><code>U / O</code> rotate zw</span>
      <span><code>[ / ]</code> change 4D lens distance</span>
    </div>
  `;
  private elapsed = 0;
  private lastHudUpdate = 0;

  constructor(private readonly options: GameAppOptions) {
    this.options.controlsElement.innerHTML = this.controlsMarkup;
    this.input = new InputController(options.canvas, options.pointerLockButton);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: options.canvas,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor('#07111c');

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#07111c', 32, 120);

    this.camera = new THREE.PerspectiveCamera(
      72,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );
    this.camera.position.set(0, 0, 0);

    this.configureScene();
    this.configureBlockMeshes();

    window.addEventListener('resize', this.handleResize);
  }

  start(): void {
    this.renderer.setAnimationLoop(this.tick);
  }

  private readonly tick = () => {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;
    this.elapsed += dt;

    this.updatePlayer(dt);
    this.updateEntities(dt);
    this.renderWorld();
    this.renderEntities();
    this.updateHud();
    this.renderer.render(this.scene, this.camera);
  };

  private readonly handleResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  };

  private configureScene(): void {
    const ambient = new THREE.HemisphereLight('#f4fbff', '#102134', 2.5);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight('#fff6dd', 2);
    keyLight.position.set(6, 12, 8);
    this.scene.add(keyLight);

    const fillLight = new THREE.PointLight('#6bc4ff', 55, 70, 2);
    fillLight.position.set(-10, 10, -12);
    this.scene.add(fillLight);

    const stars = new THREE.BufferGeometry();
    const starPositions = new Float32Array(450 * 3);

    for (let index = 0; index < 450; index += 1) {
      const stride = index * 3;
      starPositions[stride] = (Math.random() - 0.5) * 180;
      starPositions[stride + 1] = (Math.random() - 0.5) * 120;
      starPositions[stride + 2] = -Math.random() * 160 - 15;
    }

    stars.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const starMaterial = new THREE.PointsMaterial({
      color: '#8ecbff',
      opacity: 0.45,
      size: 0.16,
      transparent: true,
    });

    const starField = new THREE.Points(stars, starMaterial);
    this.scene.add(starField);
  }

  private configureBlockMeshes(): void {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const materials: BlockMaterial[] = [
      BlockMaterial.Grass,
      BlockMaterial.Stone,
      BlockMaterial.Frost,
      BlockMaterial.Ember,
    ];

    for (const materialKey of materials) {
      const materialDef = MATERIAL_DEFS[materialKey];
      const material = new THREE.MeshStandardMaterial({
        color: materialDef.baseColor,
        metalness: materialDef.metalness,
        roughness: materialDef.roughness,
        vertexColors: true,
      });
      const capacity = materialKey === BlockMaterial.Stone ? 5200 : 3400;
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.count = 0;

      this.blockMeshes.set(materialKey, {
        capacity,
        mesh,
        tint: new THREE.Color(materialDef.baseColor),
      });
      this.scene.add(mesh);
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
    const moveSpeed = boost ? 14 : 8.5;
    const verticalSpeed = boost ? 11 : 6;
    const wSpeed = boost ? 3.6 : 2.2;
    const rotationSpeed = 0.75;
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

    this.player.position4.y = clamp(
      this.player.position4.y,
      this.world.bounds.minY + 1.5,
      this.world.bounds.maxY + 8,
    );
  }

  private updateEntities(dt: number): void {
    for (const entity of this.entities) {
      entity.update(dt, this.elapsed, this.world);
    }
  }

  private renderWorld(): void {
    const counts: Record<BlockMaterial, number> = {
      [BlockMaterial.Ember]: 0,
      [BlockMaterial.Frost]: 0,
      [BlockMaterial.Grass]: 0,
      [BlockMaterial.Stone]: 0,
    };

    for (const state of this.blockMeshes.values()) {
      state.mesh.count = 0;
    }

    this.world.forEachCandidate(this.player.position4.w, (cell) => {
      const meshState = this.blockMeshes.get(cell.material);

      if (!meshState) {
        return;
      }

      const index = counts[cell.material];

      if (index >= meshState.capacity) {
        return;
      }

      const projected = this.projectPoint(cell.position4);

      if (!projected) {
        return;
      }

      const brightness = computeBlockBrightness(projected.localW);
      this.workingColor.copy(meshState.tint).multiplyScalar(brightness);
      this.composeMatrix(projected, 0.92);

      meshState.mesh.setMatrixAt(index, this.workingMatrix);
      meshState.mesh.setColorAt(index, this.workingColor);
      counts[cell.material] += 1;
    });

    for (const [material, state] of this.blockMeshes) {
      state.mesh.count = counts[material];
      state.mesh.instanceMatrix.needsUpdate = true;
      if (state.mesh.instanceColor) {
        state.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private renderEntities(): void {
    for (const entity of this.entities) {
      const snapshot = entity.snapshot();
      const view = this.getEntityView(snapshot);
      const projected = this.projectPoint(snapshot.position4);

      if (!projected) {
        view.mesh.visible = false;
        view.line.visible = false;
        continue;
      }

      view.mesh.visible = true;
      view.mesh.position.set(projected.x, projected.y, projected.z);
      view.mesh.scale.setScalar(snapshot.radius * projected.scale);
      view.mesh.rotation.x = this.elapsed * (snapshot.kind === 'anomaly' ? 0.6 : 0.2);
      view.mesh.rotation.y = this.elapsed * (snapshot.kind === 'anomaly' ? 0.4 : 0.35);

      const projectedTrail = snapshot.trail
        .map((point) => this.projectPoint(point))
        .filter((point): point is Projection3D => point !== null)
        .map((point) => new THREE.Vector3(point.x, point.y, point.z));

      if (projectedTrail.length >= 2) {
        view.line.visible = true;
        view.line.geometry.dispose();
        view.line.geometry = new THREE.BufferGeometry().setFromPoints(projectedTrail);
      } else {
        view.line.visible = false;
      }
    }
  }

  private getEntityView(snapshot: EntitySnapshot): EntityView {
    const existing = this.entityViews.get(snapshot.id);

    if (existing) {
      return existing;
    }

    const geometry =
      snapshot.kind === 'anomaly'
        ? new THREE.IcosahedronGeometry(1, 1)
        : new THREE.OctahedronGeometry(1, 0);

    const material =
      snapshot.kind === 'anomaly'
        ? new THREE.MeshStandardMaterial({
            color: snapshot.color,
            emissive: snapshot.color,
            emissiveIntensity: 1.5,
            metalness: 0.08,
            roughness: 0.3,
          })
        : new THREE.MeshStandardMaterial({
            color: snapshot.color,
            emissive: '#1d2e39',
            emissiveIntensity: 0.25,
            metalness: 0.04,
            roughness: 0.66,
          });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;

    const trailMaterial = new THREE.LineBasicMaterial({
      color: snapshot.color,
      opacity: snapshot.kind === 'anomaly' ? 0.55 : 0.25,
      transparent: true,
    });
    const line = new THREE.Line(new THREE.BufferGeometry(), trailMaterial);
    line.frustumCulled = false;

    this.scene.add(line);
    this.scene.add(mesh);

    const view = { line, mesh };
    this.entityViews.set(snapshot.id, view);

    return view;
  }

  private composeMatrix(projected: Projection3D, baseScale: number): void {
    this.workingScale.setScalar(baseScale * projected.scale);
    this.workingQuaternion.identity();
    this.workingMatrix.compose(
      new THREE.Vector3(projected.x, projected.y, projected.z),
      this.workingQuaternion,
      this.workingScale,
    );
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

    this.statusRows.push(this.renderMetric('x y z', this.formatVec3(this.player.position4)));
    this.statusRows.push(this.renderMetric('w', this.player.position4.w.toFixed(2)));
    this.statusRows.push(this.renderMetric('lens d', this.player.projectionDistance.toFixed(2)));
    this.statusRows.push(
      this.renderMetric(
        'rot xw / yw / zw',
        `${this.player.orientation.xw.toFixed(2)} / ${this.player.orientation.yw.toFixed(2)} / ${this.player.orientation.zw.toFixed(2)}`,
      ),
    );

    const anomalyCount = this.entities.filter((entity) => entity.kind === 'anomaly').length;
    const wildlifeCount = this.entities.length - anomalyCount;
    const nearest = this.findNearestEntity();

    this.entityRows.push(this.renderMetric('anomalies', String(anomalyCount)));
    this.entityRows.push(this.renderMetric('wildlife', String(wildlifeCount)));
    this.entityRows.push(
      this.renderMetric(
        'nearest',
        nearest ? `${nearest.label} · ${distance4(nearest.position4, this.player.position4).toFixed(1)}u` : 'none',
      ),
    );

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

  private formatVec3(position: Vec4): string {
    return `${position.x.toFixed(1)} · ${position.y.toFixed(1)} · ${position.z.toFixed(1)}`;
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
