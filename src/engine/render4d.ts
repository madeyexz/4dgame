import {
  applyViewTransform,
  clamp,
  project4Dto3D,
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
  maxAbsW: 3.8,
  maxDistance: 44,
  maxX: 80,
  maxY: 60,
  maxZDepth: 140,
  minZDepth: 0.3,
} as const;

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
  return clamp(1.08 - Math.abs(localW) * 0.12, 0.35, 1.1);
}
