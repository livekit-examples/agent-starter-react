import { log } from './logging';

export type Vector2<T = number> = [T, T];
export type Vector3<T = number> = [T, T, T];
export type Vector4<T = number> = [T, T, T, T];
// biome-ignore format:
export type Matrix2<T = number> = [T, T, T, T];
// biome-ignore format:
export type Matrix3<T = number> = [T, T, T, T, T, T, T, T, T];
// biome-ignore format:
export type Matrix4<T = number> = [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T];
export type Uniforms = {
  '1i': number;
  '2i': Vector2;
  '3i': Vector3;
  '4i': Vector4;
  '1f': number;
  '2f': Vector2;
  '3f': Vector3;
  '4f': Vector4;
  '1iv': Float32List;
  '2iv': Float32List;
  '3iv': Float32List;
  '4iv': Float32List;
  '1fv': Float32List;
  '2fv': Float32List;
  '3fv': Float32List;
  '4fv': Float32List;
  Matrix2fv: Float32List;
  Matrix3fv: Float32List;
  Matrix4fv: Float32List;
};
export type UniformType = keyof Uniforms;

export function isMatrixType(t: string, v: number[] | number): v is number[] {
  return t.includes('Matrix') && Array.isArray(v);
}
export function isVectorListType(t: string, v: number[] | number): v is number[] {
  return t.includes('v') && Array.isArray(v) && v.length > Number.parseInt(t.charAt(0));
}
function isVectorType(t: string, v: number[] | number): v is Vector4 {
  return !t.includes('v') && Array.isArray(v) && v.length > Number.parseInt(t.charAt(0));
}
export const processUniform = <T extends UniformType>(
  gl: WebGLRenderingContext,
  location: WebGLUniformLocation,
  t: T,
  value: number | number[]
) => {
  if (isVectorType(t, value)) {
    switch (t) {
      case '2f':
        return gl.uniform2f(location, value[0], value[1]);
      case '3f':
        return gl.uniform3f(location, value[0], value[1], value[2]);
      case '4f':
        return gl.uniform4f(location, value[0], value[1], value[2], value[3]);
      case '2i':
        return gl.uniform2i(location, value[0], value[1]);
      case '3i':
        return gl.uniform3i(location, value[0], value[1], value[2]);
      case '4i':
        return gl.uniform4i(location, value[0], value[1], value[2], value[3]);
    }
  }
  if (typeof value === 'number') {
    switch (t) {
      case '1i':
        return gl.uniform1i(location, value);
      default:
        return gl.uniform1f(location, value);
    }
  }
  switch (t) {
    case '1iv':
      return gl.uniform1iv(location, value);
    case '2iv':
      return gl.uniform2iv(location, value);
    case '3iv':
      return gl.uniform3iv(location, value);
    case '4iv':
      return gl.uniform4iv(location, value);
    case '1fv':
      return gl.uniform1fv(location, value);
    case '2fv':
      return gl.uniform2fv(location, value);
    case '3fv':
      return gl.uniform3fv(location, value);
    case '4fv':
      return gl.uniform4fv(location, value);
    case 'Matrix2fv':
      return gl.uniformMatrix2fv(location, false, value);
    case 'Matrix3fv':
      return gl.uniformMatrix3fv(location, false, value);
    case 'Matrix4fv':
      return gl.uniformMatrix4fv(location, false, value);
  }
};

export const uniformTypeToGLSLType = (t: string) => {
  switch (t) {
    case '1f':
      return 'float';
    case '2f':
      return 'vec2';
    case '3f':
      return 'vec3';
    case '4f':
      return 'vec4';
    case '1i':
      return 'int';
    case '2i':
      return 'ivec2';
    case '3i':
      return 'ivec3';
    case '4i':
      return 'ivec4';
    case '1iv':
      return 'int';
    case '2iv':
      return 'ivec2';
    case '3iv':
      return 'ivec3';
    case '4iv':
      return 'ivec4';
    case '1fv':
      return 'float';
    case '2fv':
      return 'vec2';
    case '3fv':
      return 'vec3';
    case '4fv':
      return 'vec4';
    case 'Matrix2fv':
      return 'mat2';
    case 'Matrix3fv':
      return 'mat3';
    case 'Matrix4fv':
      return 'mat4';
    default:
      console.error(
        log(`The uniform type "${t}" is not valid, please make sure your uniform type is valid`)
      );
  }
};
