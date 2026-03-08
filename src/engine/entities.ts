import {
  add4,
  clamp,
  distance4,
  lerp4,
  normalize4,
  scale4,
  sub4,
  type Vec4,
  vec4,
} from './math4d.ts';
import { type WorldBounds4D, type VoxelWorld4D } from './world4d.ts';

export type EntityKind = 'crew' | 'drifter';

export type EntitySnapshot = {
  color: string;
  id: string;
  kind: EntityKind;
  label: string;
  position4: Vec4;
  radius: number;
  trail: Vec4[];
};

export interface Entity4D {
  readonly kind: EntityKind;
  snapshot(): EntitySnapshot;
  update(dt: number, elapsed: number, world: VoxelWorld4D): void;
}

abstract class BaseEntity implements Entity4D {
  readonly trail: Vec4[] = [];

  constructor(
    readonly id: string,
    readonly kind: EntityKind,
    readonly label: string,
    protected position: Vec4,
    protected readonly color: string,
    protected readonly radius: number,
  ) {}

  snapshot(): EntitySnapshot {
    return {
      color: this.color,
      id: this.id,
      kind: this.kind,
      label: this.label,
      position4: this.position,
      radius: this.radius,
      trail: this.trail,
    };
  }

  protected pushTrail(next: Vec4, maxLength: number): void {
    this.trail.push(next);

    while (this.trail.length > maxLength) {
      this.trail.shift();
    }
  }

  abstract update(dt: number, elapsed: number, world: VoxelWorld4D): void;
}

class ExposedCrew extends BaseEntity {
  constructor(
    id: string,
    label: string,
    color: string,
    radius: number,
    private readonly anchor: Vec4,
    private readonly phase: number,
  ) {
    super(id, 'crew', label, anchor, color, radius);
  }

  update(_dt: number, elapsed: number): void {
    this.position = vec4(
      this.anchor.x + Math.sin(elapsed * 0.4 + this.phase) * 0.9,
      this.anchor.y + Math.sin(elapsed * 0.63 + this.phase) * 0.35,
      this.anchor.z + Math.cos(elapsed * 0.37 + this.phase) * 0.8,
      this.anchor.w + Math.sin(elapsed * 0.78 + this.phase) * 1.8,
    );
    this.pushTrail(this.position, 18);
  }
}

class PhaseDrifter extends BaseEntity {
  private target: Vec4;
  private velocity = vec4(0, 0, 0, 0);
  private retargetIn = 0;

  constructor(
    id: string,
    label: string,
    color: string,
    radius: number,
    start: Vec4,
    target: Vec4,
  ) {
    super(id, 'drifter', label, start, color, radius);
    this.target = target;
  }

  update(dt: number, elapsed: number, world: VoxelWorld4D): void {
    this.retargetIn -= dt;

    if (this.retargetIn <= 0 || distance4(this.position, this.target) < 1.6) {
      this.target = this.pickTarget(world.bounds, elapsed);
      this.retargetIn = 1.4 + ((elapsed * 0.41 + this.radius) % 1.3);
    }

    const desired = scale4(normalize4(sub4(this.target, this.position)), 3.6);
    this.velocity = lerp4(this.velocity, desired, clamp(dt * 1.9, 0, 1));
    this.position = add4(this.position, scale4(this.velocity, dt));
    this.position = clampToBounds(this.position, world.bounds, 1.2);
    this.pushTrail(this.position, 22);
  }

  private pickTarget(bounds: WorldBounds4D, elapsed: number): Vec4 {
    const base = elapsed * 0.85 + this.radius * 11.7;
    return vec4(
      mapSinToRange(base * 0.79 + 1.1, bounds.minX + 3, bounds.maxX - 3),
      mapSinToRange(base * 1.07, 2.5, bounds.maxY - 1.5),
      mapSinToRange(base * 0.92 + 2.8, bounds.minZ + 5, bounds.maxZ - 5),
      mapSinToRange(base * 1.44 + 4.1, bounds.minW + 0.7, bounds.maxW - 0.7),
    );
  }
}

function clampToBounds(value: Vec4, bounds: WorldBounds4D, padding: number): Vec4 {
  return vec4(
    clamp(value.x, bounds.minX + padding, bounds.maxX - padding),
    clamp(value.y, bounds.minY + padding, bounds.maxY - padding),
    clamp(value.z, bounds.minZ + padding, bounds.maxZ - padding),
    clamp(value.w, bounds.minW + 0.3, bounds.maxW - 0.3),
  );
}

function mapSinToRange(value: number, min: number, max: number): number {
  const normalized = Math.sin(value) * 0.5 + 0.5;
  return min + (max - min) * normalized;
}

export function createEntities(_world: VoxelWorld4D): Entity4D[] {
  const crew: Entity4D[] = [
    new ExposedCrew(
      'crew-medic',
      'medic, fully open',
      '#ffd1c2',
      0.56,
      vec4(-5, 4.2, -9, -0.6),
      0.2,
    ),
    new ExposedCrew(
      'crew-pilot',
      'pilot, vascular shell',
      '#c7dfff',
      0.6,
      vec4(5, 4.4, -4, 0.8),
      1.4,
    ),
    new ExposedCrew(
      'crew-engineer',
      'engineer, organs visible',
      '#ffd0ea',
      0.58,
      vec4(-4, 7.2, 4, -1.2),
      2.1,
    ),
    new ExposedCrew(
      'crew-scout',
      'scout, skeleton in phase',
      '#c9ffe1',
      0.54,
      vec4(4, 7.1, 10, 1.1),
      2.9,
    ),
  ];

  const drifters: Entity4D[] = [
    new PhaseDrifter(
      'drifter-crate',
      'locker fragment',
      '#8be9ff',
      0.48,
      vec4(-8, 5, 8, -2.4),
      vec4(6, 6, -10, 2.2),
    ),
    new PhaseDrifter(
      'drifter-gurney',
      'gurney that leaves the slice',
      '#ffe18f',
      0.52,
      vec4(7, 3.5, -7, 2.1),
      vec4(-7, 5.5, 9, -2.1),
    ),
    new PhaseDrifter(
      'drifter-core',
      'unsealed instrument core',
      '#9fb4ff',
      0.44,
      vec4(0, 8, 2, 0.4),
      vec4(4, 4.5, -12, -2.4),
    ),
  ];

  return [...crew, ...drifters];
}
