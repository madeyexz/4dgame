import {
  applyViewTransform,
  clamp,
  project4Dto3D,
  smoothstep,
  sub4,
  type Orientation4D,
  type Projection3D,
  type Vec4,
} from './math4d.ts';

export type ProjectionViewState = {
  orientation: Orientation4D;
  position4: Vec4;
  projectionDistance: number;
};

export const RENDER_LIMITS = {
  maxAbsW: 6.0,
  maxDistance: 52,
  maxX: 90,
  maxY: 70,
  maxZDepth: 160,
  minZDepth: 0.3,
} as const;

export type PhaseAppearance = {
  /** Full opacity band — near w=0 */
  solidAlpha: number;
  /** Ghosted/faded band — mid-range w */
  ghostAlpha: number;
  /** Fringe/emissive edge band — far w */
  fringeAlpha: number;
  /** Scale modification from phase distance */
  phaseScale: number;
};

export function computePhaseAppearance(localW: number): PhaseAppearance {
  const aw = Math.abs(localW);
  return {
    solidAlpha: smoothstep(1.8, 0.0, aw),
    ghostAlpha: smoothstep(5.0, 0.8, aw),
    fringeAlpha: smoothstep(2.5, 4.2, aw) * smoothstep(6.0, 5.0, aw),
    phaseScale: 1 - aw * 0.04,
  };
}

export function projectRenderablePoint(
  point: Vec4,
  player: ProjectionViewState,
): Projection3D | null {
  const local = applyViewTransform(sub4(point, player.position4), player.orientation);

  if (Math.abs(local.w) > RENDER_LIMITS.maxAbsW) {
    return null;
  }

  const spatialDistanceSq = local.x * local.x + local.y * local.y + local.z * local.z;

  if (spatialDistanceSq > RENDER_LIMITS.maxDistance * RENDER_LIMITS.maxDistance) {
    return null;
  }

  const projected = project4Dto3D(local, player.projectionDistance);

  if (!projected) {
    return null;
  }

  if (projected.z > -RENDER_LIMITS.minZDepth || projected.z < -RENDER_LIMITS.maxZDepth) {
    return null;
  }

  if (Math.abs(projected.x) > RENDER_LIMITS.maxX || Math.abs(projected.y) > RENDER_LIMITS.maxY) {
    return null;
  }

  return projected;
}

export function computeBlockBrightness(localW: number): number {
  const phase = computePhaseAppearance(localW);
  return clamp(phase.solidAlpha * 0.8 + phase.ghostAlpha * 0.3 + 0.15, 0.12, 1.1);
}
