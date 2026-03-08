export type RotationPlane = 'xw' | 'yw' | 'zw';

export type Vec4 = {
  w: number;
  x: number;
  y: number;
  z: number;
};

export type Orientation4D = {
  pitch: number;
  xw: number;
  yaw: number;
  yw: number;
  zw: number;
};

export type Projection3D = {
  localW: number;
  scale: number;
  x: number;
  y: number;
  z: number;
};

export function vec4(x: number, y: number, z: number, w: number): Vec4 {
  return { w, x, y, z };
}

export function add4(left: Vec4, right: Vec4): Vec4 {
  return vec4(
    left.x + right.x,
    left.y + right.y,
    left.z + right.z,
    left.w + right.w,
  );
}

export function sub4(left: Vec4, right: Vec4): Vec4 {
  return vec4(
    left.x - right.x,
    left.y - right.y,
    left.z - right.z,
    left.w - right.w,
  );
}

export function scale4(value: Vec4, scalar: number): Vec4 {
  return vec4(
    value.x * scalar,
    value.y * scalar,
    value.z * scalar,
    value.w * scalar,
  );
}

export function length4(value: Vec4): number {
  return Math.hypot(value.x, value.y, value.z, value.w);
}

export function normalize4(value: Vec4): Vec4 {
  const length = length4(value);

  if (length < 1e-6) {
    return vec4(0, 0, 0, 0);
  }

  return scale4(value, 1 / length);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function lerp(left: number, right: number, t: number): number {
  return left + (right - left) * t;
}

export function lerp4(left: Vec4, right: Vec4, t: number): Vec4 {
  return vec4(
    lerp(left.x, right.x, t),
    lerp(left.y, right.y, t),
    lerp(left.z, right.z, t),
    lerp(left.w, right.w, t),
  );
}

export function rotateSpatial(value: Vec4, yaw: number, pitch: number): Vec4 {
  const yawCos = Math.cos(yaw);
  const yawSin = Math.sin(yaw);
  const yawX = value.x * yawCos - value.z * yawSin;
  const yawZ = value.x * yawSin + value.z * yawCos;

  const pitchCos = Math.cos(pitch);
  const pitchSin = Math.sin(pitch);
  const pitchY = value.y * pitchCos - yawZ * pitchSin;
  const pitchZ = value.y * pitchSin + yawZ * pitchCos;

  return vec4(yawX, pitchY, pitchZ, value.w);
}

export function rotatePlane(value: Vec4, plane: RotationPlane, angle: number): Vec4 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  switch (plane) {
    case 'xw':
      return vec4(
        value.x * cos - value.w * sin,
        value.y,
        value.z,
        value.x * sin + value.w * cos,
      );
    case 'yw':
      return vec4(
        value.x,
        value.y * cos - value.w * sin,
        value.z,
        value.y * sin + value.w * cos,
      );
    case 'zw':
      return vec4(
        value.x,
        value.y,
        value.z * cos - value.w * sin,
        value.z * sin + value.w * cos,
      );
  }
}

export function applyViewTransform(value: Vec4, orientation: Orientation4D): Vec4 {
  let transformed = rotateSpatial(value, -orientation.yaw, -orientation.pitch);
  transformed = rotatePlane(transformed, 'xw', -orientation.xw);
  transformed = rotatePlane(transformed, 'yw', -orientation.yw);
  transformed = rotatePlane(transformed, 'zw', -orientation.zw);
  return transformed;
}

export function project4Dto3D(value: Vec4, lensDistance: number): Projection3D | null {
  const denominator = lensDistance - value.w;

  if (denominator <= 0.45) {
    return null;
  }

  const scale = lensDistance / denominator;

  if (scale < 0.18 || scale > 7.5) {
    return null;
  }

  return {
    localW: value.w,
    scale,
    x: value.x * scale,
    y: value.y * scale,
    z: value.z * scale,
  };
}

export function distance4(left: Vec4, right: Vec4): number {
  return length4(sub4(left, right));
}
