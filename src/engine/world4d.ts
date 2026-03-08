import { vec4, type Vec4 } from './math4d.ts';

export enum BlockMaterial {
  Bulkhead = 'bulkhead',
  Debris = 'debris',
  Frame = 'frame',
  Hull = 'hull',
  Lumen = 'lumen',
  Membrane = 'membrane',
  Tissue = 'tissue',
}

export const MATERIAL_DEFS: Record<
  BlockMaterial,
  {
    baseColor: string;
    emissive?: string;
    emissiveIntensity?: number;
    metalness: number;
    opacity: number;
    roughness: number;
  }
> = {
  [BlockMaterial.Bulkhead]: {
    baseColor: '#2f3d57',
    emissive: '#142339',
    emissiveIntensity: 0.45,
    metalness: 0.2,
    opacity: 0.22,
    roughness: 0.86,
  },
  [BlockMaterial.Debris]: {
    baseColor: '#a08872',
    emissive: '#4a3928',
    emissiveIntensity: 0.25,
    metalness: 0.55,
    opacity: 0.45,
    roughness: 0.65,
  },
  [BlockMaterial.Frame]: {
    baseColor: '#3a4a5e',
    emissive: '#1a2a3e',
    emissiveIntensity: 0.15,
    metalness: 0.75,
    opacity: 0.88,
    roughness: 0.45,
  },
  [BlockMaterial.Hull]: {
    baseColor: '#84a8d8',
    emissive: '#9fd7ff',
    emissiveIntensity: 0.55,
    metalness: 0.42,
    opacity: 0.2,
    roughness: 0.4,
  },
  [BlockMaterial.Lumen]: {
    baseColor: '#93f1ff',
    emissive: '#93f1ff',
    emissiveIntensity: 1.35,
    metalness: 0.04,
    opacity: 0.92,
    roughness: 0.2,
  },
  [BlockMaterial.Membrane]: {
    baseColor: '#6a9cc8',
    emissive: '#4a7ca8',
    emissiveIntensity: 0.2,
    metalness: 0.1,
    opacity: 0.15,
    roughness: 0.3,
  },
  [BlockMaterial.Tissue]: {
    baseColor: '#ff9d8b',
    emissive: '#ffb19b',
    emissiveIntensity: 0.8,
    metalness: 0.03,
    opacity: 0.82,
    roughness: 0.58,
  },
};

export type VoxelCell = {
  material: BlockMaterial;
  position4: Vec4;
};

export type WorldBounds4D = {
  maxW: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  minW: number;
  minX: number;
  minY: number;
  minZ: number;
};

const WORLD_DIMS = {
  height: 12,
  widthW: 9,
  widthX: 28,
  widthZ: 36,
};

/** Candidate w-range per material category for forEachCandidate. */
const W_RANGE_STRUCTURAL = 4.5;
const W_RANGE_LUMEN = 6.5;
const W_RANGE_SOFT = 7.0;

function wRangeFor(mat: BlockMaterial): number {
  switch (mat) {
    case BlockMaterial.Frame:
    case BlockMaterial.Hull:
    case BlockMaterial.Bulkhead:
      return W_RANGE_STRUCTURAL;
    case BlockMaterial.Lumen:
      return W_RANGE_LUMEN;
    case BlockMaterial.Membrane:
    case BlockMaterial.Debris:
    case BlockMaterial.Tissue:
      return W_RANGE_SOFT;
  }
}

export class VoxelWorld4D {
  readonly bounds: WorldBounds4D = {
    maxW: Math.floor(WORLD_DIMS.widthW / 2),
    maxX: Math.floor(WORLD_DIMS.widthX / 2) - 1,
    maxY: WORLD_DIMS.height - 1,
    maxZ: Math.floor(WORLD_DIMS.widthZ / 2) - 1,
    minW: -Math.floor(WORLD_DIMS.widthW / 2),
    minX: -Math.floor(WORLD_DIMS.widthX / 2),
    minY: 0,
    minZ: -Math.floor(WORLD_DIMS.widthZ / 2),
  };
  readonly cells: VoxelCell[] = [];

  private readonly cellMap = new Map<string, BlockMaterial>();

  constructor(private readonly seed: number) {
    this.generateShipFragment();
    this.rebuildCells();
  }

  forEachCandidate(playerW: number, visit: (cell: VoxelCell) => void): void {
    for (const cell of this.cells) {
      if (Math.abs(cell.position4.w - playerW) > wRangeFor(cell.material)) {
        continue;
      }
      visit(cell);
    }
  }

  private generateShipFragment(): void {
    for (let w = this.bounds.minW; w <= this.bounds.maxW; w += 1) {
      this.addHull(w);
      this.addDecksAndBulkheads(w);
      this.addPhaseLumen(w);
    }
    this.addDebris();
  }

  // ── Hull: 4D-warped shell with Frame ribs, Membrane skin, and torn-away gaps ──

  private addHull(w: number): void {
    for (let x = -9; x <= 9; x += 1) {
      for (let y = 1; y <= 10; y += 1) {
        for (let z = -14; z <= 14; z += 1) {
          const hull4 =
            (x * x) / 81 +
            ((y - 5.5) * (y - 5.5)) / 25 +
            ((z + 1) * (z + 1)) / 196 +
            (w * w) / 10 +
            x * w * 0.04 -
            z * w * 0.025;

          const membrane = hull4 > 0.94 && hull4 < 1.06;

          if (!membrane) continue;

          // Torn-away sections expose interior
          const tornAway = Math.sin(z * 0.22 + w * 1.15) > 0.58;
          if (tornAway) continue;

          // Structural frame ribs at regular intervals
          const isFrame =
            Math.abs(x) % 4 === 0 || Math.abs(z) % 5 === 0;

          if (isFrame) {
            this.addCell(vec4(x, y, z, w), BlockMaterial.Frame);
          } else {
            this.addCell(vec4(x, y, z, w), BlockMaterial.Membrane);
          }
        }
      }
    }

    // Solid hull patches — thicker shell bands that survive the 4D warp
    for (let x = -9; x <= 9; x += 1) {
      for (let y = 1; y <= 10; y += 1) {
        for (let z = -14; z <= 14; z += 1) {
          const hull4 =
            (x * x) / 81 +
            ((y - 5.5) * (y - 5.5)) / 25 +
            ((z + 1) * (z + 1)) / 196 +
            (w * w) / 10 +
            x * w * 0.04 -
            z * w * 0.025;

          const solidBand = hull4 > 0.82 && hull4 < 0.94;
          if (!solidBand) continue;

          // Only keep solid hull where frame ribs cross — creates chunky structural nodes
          const onRib = Math.abs(x) % 4 === 0 && Math.abs(z) % 5 === 0;
          if (!onRib) continue;

          const tornAway = Math.sin(z * 0.22 + w * 1.15) > 0.58;
          if (tornAway) continue;

          this.addCell(vec4(x, y, z, w), BlockMaterial.Hull);
        }
      }
    }
  }

  // ── Decks & bulkheads: curved through w, doorways that slide, vanishing sections ──

  private addDecksAndBulkheads(w: number): void {
    const doorShift = ((w + this.seed) % 3) - 1;
    const bulkheadSections = [-11, -5, 1, 7];
    const deckBaseYs = [3, 6, 9];

    // Decks — curved by w
    for (let z = -12; z <= 12; z += 1) {
      for (let x = -7; x <= 7; x += 1) {
        for (const baseY of deckBaseYs) {
          const deckY = baseY + Math.sin(w * 0.7 + z * 0.18) * 0.8;
          const nearestY = Math.round(deckY);

          if (Math.abs(nearestY - deckY) > 0.55) continue;
          if (nearestY < 2 || nearestY > 10) continue;

          // Vanishing bands: some deck sections disappear at certain w values
          const vanish =
            Math.sin(w * 1.3 + baseY * 0.9) > 0.7 &&
            Math.abs(x) > 3;
          if (vanish) continue;

          // Corridor opening
          if (Math.abs(x) <= 1 && z > -2 && z < 9) continue;

          this.addCell(vec4(x, nearestY, z, w), BlockMaterial.Bulkhead);
        }
      }
    }

    // Bulkhead walls — also curved
    for (const bulkheadZ of bulkheadSections) {
      // Shift bulkhead z position with w
      const shiftedZ = bulkheadZ + Math.round(Math.sin(w * 0.5) * 0.6);

      for (let x = -7; x <= 7; x += 1) {
        for (let y = 2; y <= 9; y += 1) {
          // Sliding doorway
          const doorX = doorShift + Math.round(Math.sin(w * 0.8 + bulkheadZ * 0.3) * 0.8);
          const doorway = Math.abs(x - doorX) <= 1 && y >= 3 && y <= 6;
          if (doorway) continue;

          // Some bulkheads vanish at extreme w
          if (Math.abs(w) >= 3 && bulkheadZ === 1) continue;

          this.addCell(vec4(x, y, shiftedZ, w), BlockMaterial.Bulkhead);
        }
      }
    }
  }

  // ── Phase lumen: branching luminous streams, glow pockets, exterior filaments ──

  private addPhaseLumen(w: number): void {
    const drift = Math.sin(w * 0.9 + this.seed * 0.13) * 1.6;

    // Main spine — always present
    for (let z = -13; z <= 13; z += 1) {
      const x = Math.round(Math.sin(z * 0.2 + drift) * 2);
      const y = 5 + Math.round(Math.cos(z * 0.16 + w * 0.4) * 1);
      this.addCell(vec4(x, y, z, w), BlockMaterial.Lumen);
    }

    // Branch 1 — dorsal arc
    for (let z = -8; z <= 6; z += 1) {
      const x = Math.round(Math.sin(z * 0.35 + drift + 1.2) * 3.5);
      const y = 8 + Math.round(Math.cos(z * 0.25 + w * 0.6) * 0.8);
      if (y >= 2 && y <= 10) {
        this.addCell(vec4(x, y, z, w), BlockMaterial.Lumen);
      }
    }

    // Branch 2 — ventral tendril
    for (let z = -4; z <= 10; z += 1) {
      const x = Math.round(Math.cos(z * 0.28 + drift - 0.7) * 2.5);
      const y = 3 + Math.round(Math.sin(z * 0.22 + w * 0.55) * 0.6);
      if (y >= 2 && y <= 10) {
        this.addCell(vec4(x, y, z, w), BlockMaterial.Lumen);
      }
    }

    // Branch 3 — lateral fork (port side)
    for (let z = -2; z <= 8; z += 1) {
      const x = -4 + Math.round(Math.sin(z * 0.3 + w * 0.45) * 1.5);
      const y = 5 + Math.round(Math.cos(z * 0.19 + drift * 0.7) * 1.2);
      if (y >= 2 && y <= 10 && Math.abs(x) <= 8) {
        this.addCell(vec4(x, y, z, w), BlockMaterial.Lumen);
      }
    }

    // Glow pockets — near torn-away fracture zones
    for (let z = -12; z <= 12; z += 3) {
      for (let x = -7; x <= 7; x += 3) {
        const tornAway = Math.sin(z * 0.22 + w * 1.15) > 0.58;
        if (!tornAway) continue;

        const y = 5 + Math.round(Math.sin(x * 0.4 + w * 0.7 + this.seed * 0.2) * 2);
        if (y >= 2 && y <= 10) {
          this.addCell(vec4(x, y, z, w), BlockMaterial.Lumen);
        }
      }
    }

    // Exterior filaments — lumen traces outside the hull envelope
    for (let z = -10; z <= 10; z += 4) {
      const hull4Probe =
        (10 * 10) / 81 +
        ((5.5 - 5.5) * (5.5 - 5.5)) / 25 +
        ((z + 1) * (z + 1)) / 196 +
        (w * w) / 10;

      if (hull4Probe < 1.1) continue; // Only outside

      const fx = Math.round(Math.sin(z * 0.15 + w * 1.1 + this.seed) * 2);
      const fy = 5 + Math.round(Math.cos(z * 0.3 + w * 0.8) * 2);
      if (fy >= 1 && fy <= 11) {
        this.addCell(vec4(fx + (fx > 0 ? 2 : -2), fy, z, w), BlockMaterial.Lumen);
      }
    }
  }

  // ── Debris: detached hull shards floating at offset w values ──

  private addDebris(): void {
    const shardDefs = [
      { cx: 7, cy: 6, cz: 11, cw: 2, rx: 2, ry: 1, rz: 3 },
      { cx: -6, cy: 8, cz: -10, cw: -3, rx: 1, ry: 2, rz: 2 },
      { cx: 8, cy: 3, cz: 5, cw: 3, rx: 2, ry: 1, rz: 2 },
      { cx: -8, cy: 4, cz: 8, cw: -2, rx: 1, ry: 1, rz: 3 },
      { cx: 5, cy: 9, cz: -6, cw: 1, rx: 2, ry: 1, rz: 2 },
      { cx: -3, cy: 2, cz: 12, cw: 3, rx: 1, ry: 1, rz: 2 },
    ];

    for (const shard of shardDefs) {
      // Each shard spans a couple w-slices near its center
      for (let dw = -1; dw <= 1; dw += 1) {
        const w = shard.cw + dw;
        if (w < this.bounds.minW || w > this.bounds.maxW) continue;

        for (let dx = -shard.rx; dx <= shard.rx; dx += 1) {
          for (let dy = -shard.ry; dy <= shard.ry; dy += 1) {
            for (let dz = -shard.rz; dz <= shard.rz; dz += 1) {
              // Ellipsoidal shard shape
              const dist =
                (dx * dx) / (shard.rx * shard.rx + 0.5) +
                (dy * dy) / (shard.ry * shard.ry + 0.5) +
                (dz * dz) / (shard.rz * shard.rz + 0.5);
              if (dist > 1) continue;

              // Shard surface only (hollow)
              if (dist < 0.45) continue;

              const x = shard.cx + dx;
              const y = shard.cy + dy;
              const z = shard.cz + dz;
              this.addCell(vec4(x, y, z, w), BlockMaterial.Debris);
            }
          }
        }
      }
    }
  }

  private addCell(position4: Vec4, material: BlockMaterial): void {
    const key = `${position4.x}|${position4.y}|${position4.z}|${position4.w}`;
    this.cellMap.set(key, material);
  }

  private rebuildCells(): void {
    this.cells.length = 0;

    for (const [key, material] of this.cellMap) {
      const [x, y, z, w] = key.split('|').map(Number);
      this.cells.push({
        material,
        position4: vec4(x, y, z, w),
      });
    }
  }
}
