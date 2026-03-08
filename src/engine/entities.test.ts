import { describe, expect, it } from 'vitest';

import { distance4 } from './math4d.ts';
import { createEntities } from './entities.ts';
import { VoxelWorld4D } from './world4d.ts';

describe('entities', () => {
  it('creates the expected anomaly and wildlife population', () => {
    const entities = createEntities(new VoxelWorld4D(7));
    const anomalyCount = entities.filter((entity) => entity.kind === 'anomaly').length;
    const wildlifeCount = entities.filter((entity) => entity.kind === 'wildlife').length;

    expect(anomalyCount).toBe(3);
    expect(wildlifeCount).toBe(4);
  });

  it('moves scripted anomalies along deterministic paths and records trails', () => {
    const world = new VoxelWorld4D(7);
    const anomaly = createEntities(world).find((entity) => entity.kind === 'anomaly');

    expect(anomaly).toBeDefined();

    const before = anomaly?.snapshot().position4;
    anomaly?.update(0.16, 1.5, world);
    const after = anomaly?.snapshot();

    expect(after?.trail.length).toBe(1);
    expect(after && before ? distance4(before, after.position4) : 0).toBeGreaterThan(0.1);
  });

  it('keeps wildlife inside world bounds while they wander in 4D', () => {
    const world = new VoxelWorld4D(7);
    const wildlife = createEntities(world).find((entity) => entity.kind === 'wildlife');

    expect(wildlife).toBeDefined();

    for (let step = 0; step < 60; step += 1) {
      wildlife?.update(0.1, step * 0.1, world);
    }

    const snapshot = wildlife?.snapshot();
    expect(snapshot).toBeDefined();

    if (!snapshot) {
      return;
    }

    expect(snapshot.position4.x).toBeGreaterThanOrEqual(world.bounds.minX + 1);
    expect(snapshot.position4.x).toBeLessThanOrEqual(world.bounds.maxX - 1);
    expect(snapshot.position4.y).toBeGreaterThanOrEqual(world.bounds.minY + 1);
    expect(snapshot.position4.y).toBeLessThanOrEqual(world.bounds.maxY - 1);
    expect(snapshot.position4.z).toBeGreaterThanOrEqual(world.bounds.minZ + 1);
    expect(snapshot.position4.z).toBeLessThanOrEqual(world.bounds.maxZ - 1);
    expect(snapshot.position4.w).toBeGreaterThanOrEqual(world.bounds.minW + 0.3);
    expect(snapshot.position4.w).toBeLessThanOrEqual(world.bounds.maxW - 0.3);
    expect(snapshot.trail.length).toBeLessThanOrEqual(12);
    expect(snapshot.trail.length).toBeGreaterThan(0);
  });
});
