import { describe, expect, it } from 'vitest';

import {
  applyViewTransform,
  distance4,
  length4,
  normalize4,
  project4Dto3D,
  rotatePlane,
  vec4,
} from './math4d.ts';

describe('math4d', () => {
  it('preserves vector length under 4D plane rotations', () => {
    const value = vec4(3, -4, 2, 5);
    const rotated = rotatePlane(value, 'xw', Math.PI / 3);

    expect(length4(rotated)).toBeCloseTo(length4(value), 10);
  });

  it('rotates the xw plane correctly at ninety degrees', () => {
    const rotated = rotatePlane(vec4(1, 2, 3, 0), 'xw', Math.PI / 2);

    expect(rotated.x).toBeCloseTo(0, 10);
    expect(rotated.y).toBe(2);
    expect(rotated.z).toBe(3);
    expect(rotated.w).toBeCloseTo(1, 10);
  });

  it('normalizes non-zero vectors and leaves zero vectors stable', () => {
    expect(length4(normalize4(vec4(5, 0, 0, 0)))).toBeCloseTo(1, 10);
    expect(normalize4(vec4(0, 0, 0, 0))).toEqual(vec4(0, 0, 0, 0));
  });

  it('applies identity view transform when orientation is zeroed', () => {
    const point = vec4(2, -3, -7, 1.5);

    expect(
      applyViewTransform(point, {
        pitch: 0,
        xw: 0,
        yaw: 0,
        yw: 0,
        zw: 0,
      }),
    ).toEqual(point);
  });

  it('projects 4D points with perspective scaling and clips singularities', () => {
    const projection = project4Dto3D(vec4(4, -2, -8, 1), 9);

    expect(projection).not.toBeNull();
    expect(projection?.scale).toBeCloseTo(9 / 8, 10);
    expect(projection?.x).toBeCloseTo(4.5, 10);
    expect(projection?.y).toBeCloseTo(-2.25, 10);
    expect(project4Dto3D(vec4(1, 1, -3, 8.8), 9)).toBeNull();
  });

  it('measures 4D distance correctly', () => {
    expect(distance4(vec4(0, 0, 0, 0), vec4(2, 3, 6, 1))).toBeCloseTo(Math.sqrt(50), 10);
  });
});
