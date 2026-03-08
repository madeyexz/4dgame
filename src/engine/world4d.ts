import { vec4, type Vec4 } from './math4d.ts';

export enum BlockMaterial {
  Bulkhead = 'bulkhead',
  Hull = 'hull',
  Lumen = 'lumen',
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
    opacity: 0.28,
    roughness: 0.86,
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
  widthW: 7,
  widthX: 28,
  widthZ: 36,
};

const BODY_ANCHORS = [
  { x: -5, y: 4, z: -9 },
  { x: 5, y: 4, z: -4 },
  { x: -4, y: 7, z: 4 },
  { x: 4, y: 7, z: 10 },
];

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
      if (Math.abs(cell.position4.w - playerW) > 4.4) {
        continue;
      }

      visit(cell);
    }
  }

  private generateShipFragment(): void {
    for (let w = this.bounds.minW; w <= this.bounds.maxW; w += 1) {
      this.addHull(w);
      this.addDecksAndBulkheads(w);
      this.addBodyCrossSections(w);
      this.addPhaseLumen(w);
    }
  }

  private addHull(w: number): void {
    for (let x = -9; x <= 9; x += 1) {
      for (let y = 1; y <= 10; y += 1) {
        for (let z = -14; z <= 14; z += 1) {
          const fracture = z > 8 && x > 3 && w >= 1;

          if (fracture) {
            continue;
          }

          const hullShape =
            (x * x) / 81 +
            ((y - 5.5) * (y - 5.5)) / 25 +
            ((z + 1) * (z + 1)) / 196;

          if (hullShape > 1.08) {
            continue;
          }

          const shell =
            hullShape > 0.84 ||
            Math.abs(x) === 9 ||
            y === 1 ||
            y === 10 ||
            z === -14 ||
            z === 14;

          if (shell) {
            this.addCell(vec4(x, y, z, w), BlockMaterial.Hull);
          }
        }
      }
    }
  }

  private addDecksAndBulkheads(w: number): void {
    const doorShift = ((w + this.seed) % 3) - 1;
    const bulkheadSections = [-11, -5, 1, 7];

    for (let z = -12; z <= 12; z += 1) {
      for (let x = -7; x <= 7; x += 1) {
        for (const y of [3, 6, 9]) {
          if (Math.abs(x) <= 1 && z > -2 && z < 9) {
            continue;
          }

          this.addCell(vec4(x, y, z, w), BlockMaterial.Bulkhead);
        }
      }
    }

    for (const bulkheadZ of bulkheadSections) {
      for (let x = -7; x <= 7; x += 1) {
        for (let y = 2; y <= 9; y += 1) {
          const doorway = Math.abs(x - doorShift) <= 1 && y >= 3 && y <= 6;

          if (doorway) {
            continue;
          }

          this.addCell(vec4(x, y, bulkheadZ, w), BlockMaterial.Bulkhead);
        }
      }
    }
  }

  private addBodyCrossSections(w: number): void {
    BODY_ANCHORS.forEach((anchor, index) => {
      const phase = Math.sin((index + 1) * 0.8 + w * 0.95 + this.seed * 0.17);
      const center = {
        x: anchor.x + Math.round(Math.sin(w * 0.4 + index) * 1),
        y: anchor.y,
        z: anchor.z + Math.round(phase * 1),
      };

      for (let x = center.x - 1; x <= center.x + 1; x += 1) {
        for (let y = center.y - 1; y <= center.y + 1; y += 1) {
          for (let z = center.z - 2; z <= center.z + 2; z += 1) {
            const dx = x - center.x;
            const dy = y - center.y;
            const dz = (z - center.z) * 0.6;
            const distanceSq = dx * dx + dy * dy + dz * dz;

            if (distanceSq <= 1.75) {
              this.addCell(vec4(x, y, z, w), BlockMaterial.Tissue);
            } else if (distanceSq <= 3.1 && Math.abs(dy) <= 1) {
              this.addCell(vec4(x, y, z, w), BlockMaterial.Lumen);
            }
          }
        }
      }
    });
  }

  private addPhaseLumen(w: number): void {
    const drift = Math.sin(w * 0.9 + this.seed * 0.13) * 1.6;

    for (let z = -13; z <= 13; z += 1) {
      const x = Math.round(Math.sin(z * 0.2 + drift) * 2);
      const y = 5 + Math.round(Math.cos(z * 0.16 + w * 0.4) * 1);
      this.addCell(vec4(x, y, z, w), BlockMaterial.Lumen);
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
