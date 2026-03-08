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

/* ── new part / link types ─────────────────────────────────────────── */

export type EntityPartKind = 'skin' | 'bone' | 'organ' | 'vessel' | 'frame' | 'surface' | 'core';

export type EntityPart = {
  kind: EntityPartKind;
  offset4: Vec4;
  size: number;
  color: string;
  opacity: number;
  phaseWidth: number;
  geometry: 'sphere' | 'box' | 'icosahedron' | 'octahedron' | 'cylinder' | 'torus';
};

export type EntityLink = {
  from4: Vec4;
  to4: Vec4;
  color: string;
  opacity: number;
  phaseWidth: number;
};

/* ── entity snapshot / interface ───────────────────────────────────── */

export type EntityKind = 'crew' | 'drifter';

export type EntitySnapshot = {
  color: string;
  id: string;
  kind: EntityKind;
  label: string;
  position4: Vec4;
  radius: number;
  trail: Vec4[];
  parts: EntityPart[];
  links: EntityLink[];
};

export interface Entity4D {
  readonly kind: EntityKind;
  snapshot(): EntitySnapshot;
  update(dt: number, elapsed: number, world: VoxelWorld4D): void;
}

/* ── base class ────────────────────────────────────────────────────── */

abstract class BaseEntity implements Entity4D {
  readonly trail: Vec4[] = [];

  constructor(
    readonly id: string,
    readonly kind: EntityKind,
    readonly label: string,
    protected position: Vec4,
    protected readonly color: string,
    protected readonly radius: number,
    protected readonly parts: EntityPart[] = [],
    protected readonly links: EntityLink[] = [],
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
      parts: this.parts,
      links: this.links,
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

/* ── crew anatomy helpers ──────────────────────────────────────────── */

function crewParts(): EntityPart[] {
  return [
    // Skin — translucent outer shell, centered at w=0
    {
      kind: 'skin',
      offset4: vec4(0, 0, 0, 0),
      size: 1.0,
      color: '#e8d4c8',
      opacity: 0.08,
      phaseWidth: 1.2,
      geometry: 'icosahedron',
    },
    // Skull
    {
      kind: 'bone',
      offset4: vec4(0, 0.35, 0, 0.5),
      size: 0.28,
      color: '#f5f0e8',
      opacity: 0.55,
      phaseWidth: 2.5,
      geometry: 'icosahedron',
    },
    // Spine arc
    {
      kind: 'bone',
      offset4: vec4(0, -0.05, -0.08, -0.5),
      size: 0.12,
      color: '#ede8dd',
      opacity: 0.45,
      phaseWidth: 2.5,
      geometry: 'cylinder',
    },
    // Rib left
    {
      kind: 'bone',
      offset4: vec4(-0.18, 0.08, 0, 0.5),
      size: 0.09,
      color: '#f0ebe2',
      opacity: 0.4,
      phaseWidth: 2.5,
      geometry: 'cylinder',
    },
    // Rib right
    {
      kind: 'bone',
      offset4: vec4(0.18, 0.08, 0, 0.5),
      size: 0.09,
      color: '#f0ebe2',
      opacity: 0.4,
      phaseWidth: 2.5,
      geometry: 'cylinder',
    },
    // Heart
    {
      kind: 'organ',
      offset4: vec4(-0.06, 0.1, 0.04, 0.3),
      size: 0.13,
      color: '#c83232',
      opacity: 0.7,
      phaseWidth: 1.8,
      geometry: 'sphere',
    },
    // Lung left
    {
      kind: 'organ',
      offset4: vec4(-0.18, 0.12, 0.02, -0.3),
      size: 0.16,
      color: '#e8a0a0',
      opacity: 0.45,
      phaseWidth: 1.8,
      geometry: 'sphere',
    },
    // Lung right
    {
      kind: 'organ',
      offset4: vec4(0.18, 0.12, 0.02, -0.3),
      size: 0.16,
      color: '#e8a0a0',
      opacity: 0.45,
      phaseWidth: 1.8,
      geometry: 'sphere',
    },
  ];
}

function crewLinks(): EntityLink[] {
  return [
    // Aorta — heart to skull
    {
      from4: vec4(-0.06, 0.1, 0.04, 0.7),
      to4: vec4(0, 0.32, 0, 0.7),
      color: '#d04040',
      opacity: 0.5,
      phaseWidth: 2.0,
    },
    // Venous — heart down along spine
    {
      from4: vec4(-0.06, 0.1, 0.04, -0.7),
      to4: vec4(0, -0.25, -0.06, -0.7),
      color: '#4060c0',
      opacity: 0.45,
      phaseWidth: 2.0,
    },
    // Pulmonary left
    {
      from4: vec4(-0.06, 0.1, 0.04, 0.7),
      to4: vec4(-0.18, 0.12, 0.02, 0.7),
      color: '#d04040',
      opacity: 0.4,
      phaseWidth: 2.0,
    },
    // Pulmonary right
    {
      from4: vec4(-0.06, 0.1, 0.04, -0.7),
      to4: vec4(0.18, 0.12, 0.02, -0.7),
      color: '#4060c0',
      opacity: 0.4,
      phaseWidth: 2.0,
    },
  ];
}

/* ── drifter anatomy helpers ───────────────────────────────────────── */

function lockerParts(): EntityPart[] {
  return [
    { kind: 'frame', offset4: vec4(0, 0, 0, 0), size: 1.0, color: '#5a8aaa', opacity: 0.35, phaseWidth: 2.0, geometry: 'box' },
    { kind: 'surface', offset4: vec4(0, 0, 0.15, 0.3), size: 0.85, color: '#7ab8d8', opacity: 0.2, phaseWidth: 1.4, geometry: 'box' },
    { kind: 'surface', offset4: vec4(0, 0, -0.15, -0.3), size: 0.85, color: '#7ab8d8', opacity: 0.2, phaseWidth: 1.4, geometry: 'box' },
    { kind: 'core', offset4: vec4(0.08, 0, 0, 0.5), size: 0.18, color: '#e0f0ff', opacity: 0.6, phaseWidth: 1.8, geometry: 'sphere' },
    { kind: 'core', offset4: vec4(-0.1, -0.05, 0, -0.5), size: 0.14, color: '#e0f0ff', opacity: 0.55, phaseWidth: 1.8, geometry: 'sphere' },
  ];
}

function gurneyParts(): EntityPart[] {
  return [
    { kind: 'frame', offset4: vec4(0, -0.12, 0, 0), size: 0.9, color: '#b0a060', opacity: 0.4, phaseWidth: 2.2, geometry: 'box' },
    { kind: 'surface', offset4: vec4(0, 0, 0, 0.3), size: 0.75, color: '#e8d8a0', opacity: 0.3, phaseWidth: 1.6, geometry: 'box' },
    { kind: 'frame', offset4: vec4(-0.3, -0.06, 0, -0.4), size: 0.12, color: '#a09060', opacity: 0.5, phaseWidth: 2.0, geometry: 'cylinder' },
    { kind: 'frame', offset4: vec4(0.3, -0.06, 0, -0.4), size: 0.12, color: '#a09060', opacity: 0.5, phaseWidth: 2.0, geometry: 'cylinder' },
  ];
}

function instrumentCoreParts(): EntityPart[] {
  return [
    { kind: 'frame', offset4: vec4(0, 0, 0, 0), size: 1.0, color: '#7080c0', opacity: 0.2, phaseWidth: 2.4, geometry: 'icosahedron' },
    { kind: 'core', offset4: vec4(0, 0, 0, 0.4), size: 0.35, color: '#a0b0ff', opacity: 0.55, phaseWidth: 1.6, geometry: 'torus' },
    { kind: 'core', offset4: vec4(0, 0, 0, -0.4), size: 0.22, color: '#d0d8ff', opacity: 0.85, phaseWidth: 1.2, geometry: 'sphere' },
  ];
}

/* ── exposed crew (multipart, slow drift, no trail) ────────────────── */

class ExposedCrew extends BaseEntity {
  constructor(
    id: string,
    label: string,
    color: string,
    radius: number,
    private readonly anchor: Vec4,
    private readonly phase: number,
  ) {
    super(id, 'crew', label, anchor, color, radius, crewParts(), crewLinks());
  }

  update(_dt: number, elapsed: number): void {
    this.position = vec4(
      this.anchor.x + Math.sin(elapsed * 0.15 + this.phase) * 0.3,
      this.anchor.y + Math.sin(elapsed * 0.22 + this.phase) * 0.12,
      this.anchor.z + Math.cos(elapsed * 0.13 + this.phase) * 0.28,
      this.anchor.w + Math.sin(elapsed * 0.3 + this.phase) * 0.4,
    );
    // No trail for crew — they float silently exposed
  }
}

/* ── phase drifter (multipart, short trail) ────────────────────────── */

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
    parts: EntityPart[] = [],
    links: EntityLink[] = [],
  ) {
    super(id, 'drifter', label, start, color, radius, parts, links);
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
    this.pushTrail(this.position, 4);
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

/* ── utilities ─────────────────────────────────────────────────────── */

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

/* ── factory ───────────────────────────────────────────────────────── */

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
      lockerParts(),
    ),
    new PhaseDrifter(
      'drifter-gurney',
      'gurney that leaves the slice',
      '#ffe18f',
      0.52,
      vec4(7, 3.5, -7, 2.1),
      vec4(-7, 5.5, 9, -2.1),
      gurneyParts(),
    ),
    new PhaseDrifter(
      'drifter-core',
      'unsealed instrument core',
      '#9fb4ff',
      0.44,
      vec4(0, 8, 2, 0.4),
      vec4(4, 4.5, -12, -2.4),
      instrumentCoreParts(),
    ),
  ];

  return [...crew, ...drifters];
}
