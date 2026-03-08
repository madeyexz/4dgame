import { describe, expect, it } from 'vitest';

import { distance4 } from './math4d.ts';
import { createEntities } from './entities.ts';
import { VoxelWorld4D } from './world4d.ts';

describe('entities', () => {
  it('creates the expected exposed-crew and drifter population', () => {
    const entities = createEntities(new VoxelWorld4D(7));
    const crewCount = entities.filter((entity) => entity.kind === 'crew').length;
    const drifterCount = entities.filter((entity) => entity.kind === 'drifter').length;

    expect(crewCount).toBe(4);
    expect(drifterCount).toBe(3);
  });

  it('moves exposed crew along deterministic phase paths and records trails', () => {
    const world = new VoxelWorld4D(7);
    const crew = createEntities(world).find((entity) => entity.kind === 'crew');

    expect(crew).toBeDefined();

    const before = crew?.snapshot().position4;
    crew?.update(0.16, 1.5, world);
    const after = crew?.snapshot();

    expect(after?.trail.length).toBe(0);
    expect(after && before ? distance4(before, after.position4) : 0).toBeGreaterThan(0.01);
    expect(after?.parts.length).toBeGreaterThan(0);
    expect(after?.links.length).toBeGreaterThan(0);
  });

  it('keeps drifting objects inside world bounds while they wander in 4D', () => {
    const world = new VoxelWorld4D(7);
    const drifter = createEntities(world).find((entity) => entity.kind === 'drifter');

    expect(drifter).toBeDefined();

    for (let step = 0; step < 60; step += 1) {
      drifter?.update(0.1, step * 0.1, world);
    }

    const snapshot = drifter?.snapshot();
    expect(snapshot).toBeDefined();

    if (!snapshot) {
      return;
    }

    expect(snapshot.position4.x).toBeGreaterThanOrEqual(world.bounds.minX + 1.2);
    expect(snapshot.position4.x).toBeLessThanOrEqual(world.bounds.maxX - 1.2);
    expect(snapshot.position4.y).toBeGreaterThanOrEqual(world.bounds.minY + 1.2);
    expect(snapshot.position4.y).toBeLessThanOrEqual(world.bounds.maxY - 1.2);
    expect(snapshot.position4.z).toBeGreaterThanOrEqual(world.bounds.minZ + 1.2);
    expect(snapshot.position4.z).toBeLessThanOrEqual(world.bounds.maxZ - 1.2);
    expect(snapshot.position4.w).toBeGreaterThanOrEqual(world.bounds.minW + 0.3);
    expect(snapshot.position4.w).toBeLessThanOrEqual(world.bounds.maxW - 0.3);
    expect(snapshot.trail.length).toBeLessThanOrEqual(4);
    expect(snapshot.trail.length).toBeGreaterThan(0);
  });
});
