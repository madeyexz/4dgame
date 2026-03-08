import { clamp, vec4, type Vec4 } from './math4d.ts';

export enum BlockMaterial {
  Ember = 'ember',
  Frost = 'frost',
  Grass = 'grass',
  Stone = 'stone',
}

export const MATERIAL_DEFS: Record<
  BlockMaterial,
  {
    baseColor: string;
    metalness: number;
    roughness: number;
  }
> = {
  [BlockMaterial.Ember]: {
    baseColor: '#ff8b42',
    metalness: 0.14,
    roughness: 0.48,
  },
  [BlockMaterial.Frost]: {
    baseColor: '#8de8ff',
    metalness: 0.1,
    roughness: 0.32,
  },
  [BlockMaterial.Grass]: {
    baseColor: '#7ccb6d',
    metalness: 0.04,
    roughness: 0.88,
  },
  [BlockMaterial.Stone]: {
    baseColor: '#738aa3',
    metalness: 0.04,
    roughness: 0.92,
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
  widthX: 20,
  widthZ: 20,
};

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
    this.generateTerrain();
    this.addLandmarks();
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

  private generateTerrain(): void {
    for (let w = this.bounds.minW; w <= this.bounds.maxW; w += 1) {
      for (let x = this.bounds.minX; x <= this.bounds.maxX; x += 1) {
        for (let z = this.bounds.minZ; z <= this.bounds.maxZ; z += 1) {
          const dune =
            Math.sin((x + this.seed) * 0.37 + w * 0.84) * 1.65 +
            Math.cos((z - this.seed) * 0.31 - w * 0.72) * 1.4;
          const ridge = Math.sin((x + z) * 0.18 + w * 1.5) * 0.9;
          const shelf = Math.cos((x - z) * 0.12 - w * 0.35) * 0.55;
          const height = clamp(Math.floor(4.8 + dune + ridge + shelf), 2, 9);

          for (let y = 0; y <= height; y += 1) {
            const material = this.pickMaterial(y, height, w);
            this.addCell(vec4(x, y, z, w), material);
          }

          const crystalNoise = Math.sin(x * 0.61 + z * 0.27 + w * 1.43 + this.seed * 0.21);

          if (crystalNoise > 0.94) {
            this.addCell(vec4(x, height + 1, z, w), BlockMaterial.Frost);
          }
        }
      }
    }
  }

  private addLandmarks(): void {
    for (let w = this.bounds.minW; w <= this.bounds.maxW; w += 1) {
      for (let y = 3; y <= 9; y += 1) {
        this.addCell(vec4(0, y, 0, w), BlockMaterial.Ember);
      }

      this.addCell(vec4(1, 4 + (w & 1), -3, w), BlockMaterial.Frost);
      this.addCell(vec4(-1, 5 + ((w + 1) & 1), 3, w), BlockMaterial.Frost);
    }

    for (let offset = -3; offset <= 3; offset += 1) {
      this.addCell(vec4(-6, 6, offset * 2, offset), BlockMaterial.Ember);
      this.addCell(vec4(6, 7, -offset * 2, offset), BlockMaterial.Ember);
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

  private pickMaterial(y: number, height: number, w: number): BlockMaterial {
    if (y === height) {
      return Math.abs(w) >= 2 ? BlockMaterial.Frost : BlockMaterial.Grass;
    }

    if (y <= 1 || y < height - 2) {
      return BlockMaterial.Stone;
    }

    return Math.abs(w) === 3 ? BlockMaterial.Frost : BlockMaterial.Stone;
  }
}
