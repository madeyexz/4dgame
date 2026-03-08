import { describe, expect, it } from 'vitest';

import { BlockMaterial, VoxelWorld4D } from './world4d.ts';

describe('VoxelWorld4D', () => {
  it('generates deterministic cell layouts for the same seed', () => {
    const first = new VoxelWorld4D(7);
    const second = new VoxelWorld4D(7);

    expect(first.cells).toEqual(second.cells);
  });

  it('produces different ship fragments for different seeds', () => {
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

  it('builds a ship fragment with hull and exposed tissue', () => {
    const world = new VoxelWorld4D(7);
    const hullCells = world.cells.filter((cell) => cell.material === BlockMaterial.Hull);
    const tissueCells = world.cells.filter((cell) => cell.material === BlockMaterial.Tissue);
    const lumenCells = world.cells.filter((cell) => cell.material === BlockMaterial.Lumen);

    expect(hullCells.length).toBeGreaterThan(0);
    expect(tissueCells.length).toBeGreaterThan(0);
    expect(lumenCells.length).toBeGreaterThan(0);
  });

  it('threads the luminous spine through every w layer', () => {
    const world = new VoxelWorld4D(7);
    const spineCells = world.cells.filter(
      (cell) =>
        cell.material === BlockMaterial.Lumen &&
        cell.position4.z >= -13 &&
        cell.position4.z <= 13,
    );

    const uniqueW = new Set(spineCells.map((cell) => cell.position4.w));
    expect(uniqueW.size).toBe(world.bounds.maxW - world.bounds.minW + 1);
  });
});
