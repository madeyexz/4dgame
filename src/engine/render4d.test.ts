import { describe, expect, it } from 'vitest';

import { vec4 } from './math4d.ts';
import {
  computeBlockBrightness,
  projectRenderablePoint,
  RENDER_LIMITS,
  type ProjectionViewState,
} from './render4d.ts';

const defaultPlayer: ProjectionViewState = {
  orientation: {
    pitch: 0,
    xw: 0,
    yaw: 0,
    yw: 0,
    zw: 0,
  },
  position4: vec4(0, 0, 0, 0),
  projectionDistance: 9.5,
};

describe('render4d', () => {
  it('projects points inside the render budget', () => {
    const projected = projectRenderablePoint(vec4(2, 1, -8, 0.5), defaultPlayer);

    expect(projected).not.toBeNull();
    expect(projected?.z).toBeLessThan(-RENDER_LIMITS.minZDepth);
  });

  it('clips points outside the w band', () => {
    expect(projectRenderablePoint(vec4(0, 0, -8, 4.2), defaultPlayer)).toBeNull();
  });

  it('clips points that are too far away in xyz distance', () => {
    expect(projectRenderablePoint(vec4(0, 0, -(RENDER_LIMITS.maxDistance + 2), 0), defaultPlayer)).toBeNull();
  });

  it('clips points behind the camera or outside the screen envelope', () => {
    expect(projectRenderablePoint(vec4(0, 0, 2, 0), defaultPlayer)).toBeNull();
    expect(projectRenderablePoint(vec4(200, 0, -1, 0), defaultPlayer)).toBeNull();
  });

  it('dims blocks farther from the local w slice', () => {
    expect(computeBlockBrightness(0)).toBeCloseTo(1.08, 10);
    expect(computeBlockBrightness(2)).toBeLessThan(computeBlockBrightness(0));
    expect(computeBlockBrightness(10)).toBe(0.35);
  });
});
