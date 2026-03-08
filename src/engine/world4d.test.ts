import { describe, expect, it } from 'vitest';

import { BlockMaterial, VoxelWorld4D } from './world4d.ts';

describe('VoxelWorld4D', () => {
  it('generates deterministic cell layouts for the same seed', () => {
    const first = new VoxelWorld4D(7);
    const second = new VoxelWorld4D(7);

    expect(first.cells).toEqual(second.cells);
  });

  it('produces different terrain for different seeds', () => {
    const first = new VoxelWorld4D(7);
    const second = new VoxelWorld4D(8);

    expect(first.cells).not.toEqual(second.cells);
  });

  it('keeps candidate enumeration near the active w slice', () => {
    const world = new VoxelWorld4D(7);
    const visitedW = new Set<number>();

    world.forEachCandidate(0, (cell) => {
      visitedW.add(cell.position4.w);
    });

    expect([...visitedW].every((w) => Math.abs(w) <= 4.4)).toBe(true);
  });

  it('adds landmark ember pillars through every w layer', () => {
    const world = new VoxelWorld4D(7);
    const pillarCells = world.cells.filter(
      (cell) =>
        cell.material === BlockMaterial.Ember &&
        cell.position4.x === 0 &&
        cell.position4.z === 0 &&
        cell.position4.y >= 3 &&
        cell.position4.y <= 9,
    );

    const uniqueW = new Set(pillarCells.map((cell) => cell.position4.w));
    expect(uniqueW.size).toBe(world.bounds.maxW - world.bounds.minW + 1);
  });
});
