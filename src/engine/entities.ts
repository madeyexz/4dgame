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

export type EntityKind = 'anomaly' | 'wildlife';

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

class ScriptedAnomaly extends BaseEntity {
  constructor(
    id: string,
    label: string,
    color: string,
    radius: number,
    private readonly motion: (elapsed: number) => Vec4,
  ) {
    super(id, 'anomaly', label, motion(0), color, radius);
  }

  update(_dt: number, elapsed: number): void {
    this.position = this.motion(elapsed);
    this.pushTrail(this.position, 28);
  }
}

class AmbientWildlife extends BaseEntity {
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
    super(id, 'wildlife', label, start, color, radius);
    this.target = target;
  }

  update(dt: number, elapsed: number, world: VoxelWorld4D): void {
    this.retargetIn -= dt;

    if (this.retargetIn <= 0 || distance4(this.position, this.target) < 1.4) {
      this.target = this.pickTarget(world.bounds, elapsed);
      this.retargetIn = 1.8 + ((elapsed * 0.37 + this.radius) % 1.4);
    }

    const desired = scale4(normalize4(sub4(this.target, this.position)), 2.6);
    this.velocity = lerp4(this.velocity, desired, clamp(dt * 1.6, 0, 1));
    this.position = add4(this.position, scale4(this.velocity, dt));
    this.position = clampToBounds(this.position, world.bounds, 1);
    this.pushTrail(this.position, 12);
  }

  private pickTarget(bounds: WorldBounds4D, elapsed: number): Vec4 {
    const base = elapsed * 0.7 + this.radius * 9.13;
    return vec4(
      mapSinToRange(base * 0.91, bounds.minX + 2, bounds.maxX - 2),
      mapSinToRange(base * 1.21, 3, bounds.maxY - 1),
      mapSinToRange(base * 1.03 + 1.7, bounds.minZ + 2, bounds.maxZ - 2),
      mapSinToRange(base * 0.77 + 3.3, bounds.minW + 1, bounds.maxW - 1),
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

export function createEntities(world: VoxelWorld4D): Entity4D[] {
  const { bounds } = world;

  const entities: Entity4D[] = [
    new ScriptedAnomaly(
      'anomaly-helix',
      'helix choir',
      '#7bd6ff',
      0.8,
      (elapsed) =>
        vec4(
          Math.sin(elapsed * 0.68) * 7.8,
          7 + Math.sin(elapsed * 1.12) * 2.8,
          Math.cos(elapsed * 0.68) * 7.8,
          Math.sin(elapsed * 0.48) * 2.7,
        ),
    ),
    new ScriptedAnomaly(
      'anomaly-lance',
      'ember lance',
      '#ff9457',
      0.65,
      (elapsed) =>
        vec4(
          Math.sin(elapsed * 0.94) * 9,
          4.4 + Math.cos(elapsed * 0.71) * 2.2,
          -4 + Math.sin(elapsed * 0.52 + 1.3) * 6,
          Math.cos(elapsed * 0.94 + 0.7) * 2.4,
        ),
    ),
    new ScriptedAnomaly(
      'anomaly-orbit',
      'bloom knot',
      '#d6afff',
      0.95,
      (elapsed) =>
        vec4(
          Math.sin(elapsed * 0.43 + 1.1) * 5.5,
          6 + Math.sin(elapsed * 0.89 + 0.6) * 3.4,
          Math.cos(elapsed * 0.57 + 2.1) * 5.5,
          Math.sin(elapsed * 0.76 + 2.7) * 2.9,
        ),
    ),
  ];

  const wildlifeSpecs = [
    {
      color: '#b8ffcf',
      label: 'reed glider',
      radius: 0.34,
      start: vec4(bounds.minX + 4, 5, bounds.minZ + 4, -1.8),
      target: vec4(bounds.maxX - 4, 6, bounds.maxZ - 4, 1.4),
    },
    {
      color: '#f8ffad',
      label: 'thread moth',
      radius: 0.3,
      start: vec4(-5, 7, 2, 2.1),
      target: vec4(4, 4, -6, -1.7),
    },
    {
      color: '#b6e1ff',
      label: 'phase heron',
      radius: 0.36,
      start: vec4(6, 6, -5, -2.2),
      target: vec4(-6, 8, 3, 2.2),
    },
    {
      color: '#ffc4f7',
      label: 'glass koi',
      radius: 0.32,
      start: vec4(-2, 4, 6, 0.8),
      target: vec4(7, 5, -2, -0.9),
    },
  ];

  wildlifeSpecs.forEach((spec, index) => {
    entities.push(
      new AmbientWildlife(
        `wildlife-${index}`,
        spec.label,
        spec.color,
        spec.radius,
        spec.start,
        spec.target,
      ),
    );
  });

  return entities;
}
