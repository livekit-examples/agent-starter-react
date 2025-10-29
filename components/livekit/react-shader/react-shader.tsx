import { type CSSProperties, useEffect, useRef } from 'react';
import { log } from './logging';
import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipMapLinearFilter,
  LinearMipMapNearestFilter,
  MirroredRepeatWrapping,
  NearestFilter,
  NearestMipMapLinearFilter,
  NearestMipMapNearestFilter,
  RepeatWrapping,
  Texture,
} from './texture';
import {
  type UniformType,
  type Vector2,
  type Vector3,
  type Vector4,
  isMatrixType,
  isVectorListType,
  processUniform,
  uniformTypeToGLSLType,
} from './uniforms';

export {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipMapLinearFilter,
  LinearMipMapNearestFilter,
  MirroredRepeatWrapping,
  NearestFilter,
  NearestMipMapLinearFilter,
  NearestMipMapNearestFilter,
  RepeatWrapping,
};

export type { Vector2, Vector3, Vector4 };

const PRECISIONS = ['lowp', 'mediump', 'highp'];
const FS_MAIN_SHADER = `\nvoid main(void){
    vec4 color = vec4(0.0,0.0,0.0,1.0);
    mainImage( color, gl_FragCoord.xy );
    gl_FragColor = color;
}`;
const BASIC_FS = `void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 uv = fragCoord/iResolution.xy;
    vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));
    fragColor = vec4(col,1.0);
}`;
const BASIC_VS = `attribute vec3 aVertexPosition;
void main(void) {
    gl_Position = vec4(aVertexPosition, 1.0);
}`;
const UNIFORM_TIME = 'iTime';
const UNIFORM_TIMEDELTA = 'iTimeDelta';
const UNIFORM_DATE = 'iDate';
const UNIFORM_FRAME = 'iFrame';
const UNIFORM_MOUSE = 'iMouse';
const UNIFORM_RESOLUTION = 'iResolution';
const UNIFORM_CHANNEL = 'iChannel';
const UNIFORM_CHANNELRESOLUTION = 'iChannelResolution';
const UNIFORM_DEVICEORIENTATION = 'iDeviceOrientation';

const latestPointerClientCoords = (e: MouseEvent | TouchEvent) => {
  // @ts-expect-error TODO: Deal with this.
  return [e.clientX || e.changedTouches[0].clientX, e.clientY || e.changedTouches[0].clientY];
};
const lerpVal = (v0: number, v1: number, t: number) => v0 * (1 - t) + v1 * t;
const insertStringAtIndex = (currentString: string, string: string, index: number) =>
  index > 0
    ? currentString.substring(0, index) +
      string +
      currentString.substring(index, currentString.length)
    : string + currentString;

type Uniform = { type: string; value: number[] | number };
export type Uniforms = Record<string, Uniform>;
type TextureParams = {
  url: string;
  wrapS?: number;
  wrapT?: number;
  minFilter?: number;
  magFilter?: number;
  flipY?: number;
};

type Props = {
  /** Fragment shader GLSL code. */
  fs: string;

  /** Vertex shader GLSL code. */
  vs?: string;

  /**
   * Textures to be passed to the shader. Textures need to be squared or will be
   * automatically resized.
   *
   * Options default to:
   *
   * ```js
   * {
   *   minFilter: LinearMipMapLinearFilter,
   *   magFilter: LinearFilter,
   *   wrapS: RepeatWrapping,
   *   wrapT: RepeatWrapping,
   * }
   * ```
   *
   * See [textures in the docs](https://rysana.com/docs/react-shaders#textures)
   * for details.
   */
  textures?: TextureParams[];

  /**
   * Custom uniforms to be passed to the shader.
   *
   * See [custom uniforms in the
   * docs](https://rysana.com/docs/react-shaders#custom-uniforms) for details.
   */
  uniforms?: Uniforms;

  /**
   * Color used when clearing the canvas.
   *
   * See [the WebGL
   * docs](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/clearColor)
   * for details.
   */
  clearColor?: Vector4;

  /**
   * GLSL precision qualifier. Defaults to `'highp'`. Balance between
   * performance and quality.
   */
  precision?: 'highp' | 'lowp' | 'mediump';

  /** Custom inline style for canvas. */
  style?: CSSStyleDeclaration;

  /** Customize WebGL context attributes. See [the WebGL docs](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getContextAttributes) for details. */
  contextAttributes?: Record<string, unknown>;

  /** Lerp value for `iMouse` built-in uniform. Must be between 0 and 1. */
  lerp?: number;

  /** Device pixel ratio. */
  devicePixelRatio?: number;

  /**
   * Callback for when the textures are done loading. Useful if you want to do
   * something like e.g. hide the canvas until textures are done loading.
   */
  onDoneLoadingTextures?: () => void;

  /** Custom callback to handle errors. Defaults to `console.error`. */
  onError?: (error: string) => void;

  /** Custom callback to handle warnings. Defaults to `console.warn`. */
  onWarning?: (warning: string) => void;
};
export const Shader = ({
  fs,
  vs = BASIC_VS,
  textures = [],
  uniforms: propUniforms,
  clearColor = [0, 0, 0, 1],
  precision = 'highp',
  style,
  contextAttributes = {},
  lerp = 1,
  devicePixelRatio = 1,
  onDoneLoadingTextures,
  onError = console.error,
  onWarning = console.warn,
}: Props) => {
  // Refs for WebGL state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const squareVerticesBufferRef = useRef<WebGLBuffer | null>(null);
  const shaderProgramRef = useRef<WebGLProgram | null>(null);
  const vertexPositionAttributeRef = useRef<number | undefined>(undefined);
  const animFrameIdRef = useRef<number | undefined>(undefined);
  const mousedownRef = useRef(false);
  const canvasPositionRef = useRef<DOMRect | undefined>(undefined);
  const timerRef = useRef(0);
  const lastMouseArrRef = useRef<number[]>([0, 0]);
  const texturesArrRef = useRef<WebGLTexture[]>([]);
  const lastTimeRef = useRef(0);
  const resizeObserverRef = useRef<ResizeObserver | undefined>(undefined);
  const uniformsRef = useRef<
    Record<
      string,
      { type: string; isNeeded: boolean; value?: number[] | number; arraySize?: string }
    >
  >({
    [UNIFORM_TIME]: { type: 'float', isNeeded: false, value: 0 },
    [UNIFORM_TIMEDELTA]: { type: 'float', isNeeded: false, value: 0 },
    [UNIFORM_DATE]: { type: 'vec4', isNeeded: false, value: [0, 0, 0, 0] },
    [UNIFORM_MOUSE]: { type: 'vec4', isNeeded: false, value: [0, 0, 0, 0] },
    [UNIFORM_RESOLUTION]: { type: 'vec2', isNeeded: false, value: [0, 0] },
    [UNIFORM_FRAME]: { type: 'int', isNeeded: false, value: 0 },
    [UNIFORM_DEVICEORIENTATION]: { type: 'vec4', isNeeded: false, value: [0, 0, 0, 0] },
  });
  const propsUniformsRef = useRef<Uniforms | undefined>(propUniforms);

  const setupChannelRes = ({ width, height }: Texture, id: number) => {
    // @ts-expect-error TODO: Deal with this.
    uniformsRef.current.iChannelResolution.value[id * 3] = width * devicePixelRatio;
    // @ts-expect-error TODO: Deal with this.
    uniformsRef.current.iChannelResolution.value[id * 3 + 1] = height * devicePixelRatio;
    // @ts-expect-error TODO: Deal with this.
    uniformsRef.current.iChannelResolution.value[id * 3 + 2] = 0;
  };

  const initWebGL = () => {
    if (!canvasRef.current) return;
    glRef.current = (canvasRef.current.getContext('webgl', contextAttributes) ||
      canvasRef.current.getContext(
        'experimental-webgl',
        contextAttributes
      )) as WebGLRenderingContext | null;
    glRef.current?.getExtension('OES_standard_derivatives');
    glRef.current?.getExtension('EXT_shader_texture_lod');
  };

  const initBuffers = () => {
    const gl = glRef.current;
    squareVerticesBufferRef.current = gl?.createBuffer() ?? null;
    gl?.bindBuffer(gl.ARRAY_BUFFER, squareVerticesBufferRef.current);
    const vertices = [1.0, 1.0, 0.0, -1.0, 1.0, 0.0, 1.0, -1.0, 0.0, -1.0, -1.0, 0.0];
    gl?.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  };

  const onDeviceOrientationChange = ({ alpha, beta, gamma }: DeviceOrientationEvent) => {
    uniformsRef.current.iDeviceOrientation.value = [
      alpha ?? 0,
      beta ?? 0,
      gamma ?? 0,
      window.orientation || 0,
    ];
  };

  const mouseDown = (e: MouseEvent | TouchEvent) => {
    const [clientX, clientY] = latestPointerClientCoords(e);
    const mouseX = clientX - (canvasPositionRef.current?.left ?? 0) - window.pageXOffset;
    const mouseY =
      (canvasPositionRef.current?.height ?? 0) -
      clientY -
      (canvasPositionRef.current?.top ?? 0) -
      window.pageYOffset;
    mousedownRef.current = true;
    // @ts-expect-error TODO: Deal with this.
    uniformsRef.current.iMouse.value[2] = mouseX;
    // @ts-expect-error TODO: Deal with this.
    uniformsRef.current.iMouse.value[3] = mouseY;
    lastMouseArrRef.current[0] = mouseX;
    lastMouseArrRef.current[1] = mouseY;
  };

  const mouseMove = (e: MouseEvent | TouchEvent) => {
    canvasPositionRef.current = canvasRef.current?.getBoundingClientRect();
    const [clientX, clientY] = latestPointerClientCoords(e);
    const mouseX = clientX - (canvasPositionRef.current?.left ?? 0);
    const mouseY =
      (canvasPositionRef.current?.height ?? 0) - clientY - (canvasPositionRef.current?.top ?? 0);
    if (lerp !== 1) {
      lastMouseArrRef.current[0] = mouseX;
      lastMouseArrRef.current[1] = mouseY;
    } else {
      // @ts-expect-error TODO: Deal with this.
      uniformsRef.current.iMouse.value[0] = mouseX;
      // @ts-expect-error TODO: Deal with this.
      uniformsRef.current.iMouse.value[1] = mouseY;
    }
  };

  const mouseUp = () => {
    // @ts-expect-error TODO: Deal with this.
    uniformsRef.current.iMouse.value[2] = 0;
    // @ts-expect-error TODO: Deal with this.
    uniformsRef.current.iMouse.value[3] = 0;
  };

  const onResize = () => {
    const gl = glRef.current;
    if (!gl) return;
    canvasPositionRef.current = canvasRef.current?.getBoundingClientRect();
    // Force pixel ratio to be one to avoid expensive calculus on retina display.
    const realToCSSPixels = devicePixelRatio;
    const displayWidth = Math.floor((canvasPositionRef.current?.width ?? 1) * realToCSSPixels);
    const displayHeight = Math.floor((canvasPositionRef.current?.height ?? 1) * realToCSSPixels);
    gl.canvas.width = displayWidth;
    gl.canvas.height = displayHeight;
    if (uniformsRef.current.iResolution?.isNeeded && shaderProgramRef.current) {
      const rUniform = gl.getUniformLocation(shaderProgramRef.current, UNIFORM_RESOLUTION);
      gl.uniform2fv(rUniform, [gl.canvas.width, gl.canvas.height]);
    }
  };

  const createShader = (type: number, shaderCodeAsText: string) => {
    const gl = glRef.current;
    if (!gl) return null;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, shaderCodeAsText);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      onWarning?.(log(`Error compiling the shader:\n${shaderCodeAsText}`));
      const compilationLog = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      onError?.(log(`Shader compiler log: ${compilationLog}`));
    }
    return shader;
  };

  const initShaders = (fragmentShader: string, vertexShader: string) => {
    const gl = glRef.current;
    if (!gl) return;
    const fragmentShaderObj = createShader(gl.FRAGMENT_SHADER, fragmentShader);
    const vertexShaderObj = createShader(gl.VERTEX_SHADER, vertexShader);
    shaderProgramRef.current = gl.createProgram();
    if (!shaderProgramRef.current || !vertexShaderObj || !fragmentShaderObj) return;
    gl.attachShader(shaderProgramRef.current, vertexShaderObj);
    gl.attachShader(shaderProgramRef.current, fragmentShaderObj);
    gl.linkProgram(shaderProgramRef.current);
    if (!gl.getProgramParameter(shaderProgramRef.current, gl.LINK_STATUS)) {
      onError?.(
        log(
          `Unable to initialize the shader program: ${gl.getProgramInfoLog(shaderProgramRef.current)}`
        )
      );
      return;
    }
    gl.useProgram(shaderProgramRef.current);
    vertexPositionAttributeRef.current = gl.getAttribLocation(
      shaderProgramRef.current,
      'aVertexPosition'
    );
    gl.enableVertexAttribArray(vertexPositionAttributeRef.current);
  };

  const processCustomUniforms = () => {
    if (propUniforms) {
      for (const name of Object.keys(propUniforms)) {
        const uniform = propUniforms[name];
        if (!uniform) return;
        const { value, type } = uniform;
        const glslType = uniformTypeToGLSLType(type);
        if (!glslType) return;
        const tempObject: { arraySize?: string } = {};
        if (isMatrixType(type, value)) {
          const arrayLength = type.length;
          const val = Number.parseInt(type.charAt(arrayLength - 3));
          const numberOfMatrices = Math.floor(value.length / (val * val));
          if (value.length > val * val) tempObject.arraySize = `[${numberOfMatrices}]`;
        } else if (isVectorListType(type, value)) {
          tempObject.arraySize = `[${Math.floor(value.length / Number.parseInt(type.charAt(0)))}]`;
        }
        uniformsRef.current[name] = { type: glslType, isNeeded: false, value, ...tempObject };
      }
    }
  };

  const processTextures = () => {
    const gl = glRef.current;
    if (!gl) return;
    if (textures && textures.length > 0) {
      uniformsRef.current[`${UNIFORM_CHANNELRESOLUTION}`] = {
        type: 'vec3',
        isNeeded: false,
        arraySize: `[${textures.length}]`,
        value: [],
      };
      const texturePromisesArr = textures.map((texture: TextureParams, id: number) => {
        // Dynamically add textures uniforms.
        uniformsRef.current[`${UNIFORM_CHANNEL}${id}`] = {
          type: 'sampler2D',
          isNeeded: false,
        };
        // Initialize array with 0s:
        // @ts-expect-error TODO: Deal with this.
        setupChannelRes(texture, id);
        texturesArrRef.current[id] = new Texture(gl);
        return (
          texturesArrRef.current[id]
            // @ts-expect-error TODO: Deal with this.
            ?.load(texture, id)
            .then((t: Texture) => {
              setupChannelRes(t, id);
            })
        );
      });
      Promise.all(texturePromisesArr)
        .then(() => {
          if (onDoneLoadingTextures) onDoneLoadingTextures();
        })
        .catch((e) => {
          onError?.(e);
          if (onDoneLoadingTextures) onDoneLoadingTextures();
        });
    } else if (onDoneLoadingTextures) onDoneLoadingTextures();
  };

  const preProcessFragment = (fragment: string) => {
    const isValidPrecision = PRECISIONS.includes(precision ?? 'highp');
    const precisionString = `precision ${isValidPrecision ? precision : PRECISIONS[1]} float;\n`;
    if (!isValidPrecision) {
      onWarning?.(
        log(
          `wrong precision type ${precision}, please make sure to pass one of a valid precision lowp, mediump, highp, by default you shader precision will be set to highp.`
        )
      );
    }
    let fragmentShader = precisionString
      .concat(`#define DPR ${devicePixelRatio.toFixed(1)}\n`)
      .concat(fragment.replace(/texture\(/g, 'texture2D('));
    for (const uniform of Object.keys(uniformsRef.current)) {
      if (fragment.includes(uniform)) {
        const u = uniformsRef.current[uniform];
        if (!u) continue;
        fragmentShader = insertStringAtIndex(
          fragmentShader,
          `uniform ${u.type} ${uniform}${u.arraySize || ''}; \n`,
          fragmentShader.lastIndexOf(precisionString) + precisionString.length
        );
        u.isNeeded = true;
      }
    }
    const isShadertoy = fragment.includes('mainImage');
    if (isShadertoy) fragmentShader = fragmentShader.concat(FS_MAIN_SHADER);
    return fragmentShader;
  };

  const setUniforms = (timestamp: number) => {
    const gl = glRef.current;
    if (!gl || !shaderProgramRef.current) return;
    const delta = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0;
    lastTimeRef.current = timestamp;
    const propUniforms = propsUniformsRef.current;
    if (propUniforms) {
      for (const name of Object.keys(propUniforms)) {
        const currentUniform = propUniforms[name];
        if (!currentUniform) return;
        if (uniformsRef.current[name]?.isNeeded) {
          if (!shaderProgramRef.current) return;
          const customUniformLocation = gl.getUniformLocation(shaderProgramRef.current, name);
          if (!customUniformLocation) return;
          processUniform(
            gl,
            customUniformLocation,
            currentUniform.type as UniformType,
            currentUniform.value
          );
        }
      }
    }
    if (uniformsRef.current.iMouse?.isNeeded) {
      const mouseUniform = gl.getUniformLocation(shaderProgramRef.current, UNIFORM_MOUSE);
      gl.uniform4fv(mouseUniform, uniformsRef.current.iMouse.value as number[]);
    }
    if (uniformsRef.current.iChannelResolution?.isNeeded) {
      const channelResUniform = gl.getUniformLocation(
        shaderProgramRef.current,
        UNIFORM_CHANNELRESOLUTION
      );
      gl.uniform3fv(channelResUniform, uniformsRef.current.iChannelResolution.value as number[]);
    }
    if (uniformsRef.current.iDeviceOrientation?.isNeeded) {
      const deviceOrientationUniform = gl.getUniformLocation(
        shaderProgramRef.current,
        UNIFORM_DEVICEORIENTATION
      );
      gl.uniform4fv(
        deviceOrientationUniform,
        uniformsRef.current.iDeviceOrientation.value as number[]
      );
    }
    if (uniformsRef.current.iTime?.isNeeded) {
      const timeUniform = gl.getUniformLocation(shaderProgramRef.current, UNIFORM_TIME);
      gl.uniform1f(timeUniform, (timerRef.current += delta));
    }
    if (uniformsRef.current.iTimeDelta?.isNeeded) {
      const timeDeltaUniform = gl.getUniformLocation(shaderProgramRef.current, UNIFORM_TIMEDELTA);
      gl.uniform1f(timeDeltaUniform, delta);
    }
    if (uniformsRef.current.iDate?.isNeeded) {
      const d = new Date();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const year = d.getFullYear();
      const time =
        d.getHours() * 60 * 60 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() * 0.001;
      const dateUniform = gl.getUniformLocation(shaderProgramRef.current, UNIFORM_DATE);
      gl.uniform4fv(dateUniform, [year, month, day, time]);
    }
    if (uniformsRef.current.iFrame?.isNeeded) {
      const timeDeltaUniform = gl.getUniformLocation(shaderProgramRef.current, UNIFORM_FRAME);
      gl.uniform1i(timeDeltaUniform, (uniformsRef.current.iFrame.value as number)++);
    }
    if (texturesArrRef.current.length > 0) {
      for (let index = 0; index < texturesArrRef.current.length; index++) {
        // TODO: Don't use this casting if possible:
        const texture = texturesArrRef.current[index] as Texture | undefined;
        if (!texture) return;
        const { isVideo, _webglTexture, source, flipY, isLoaded } = texture;
        if (!isLoaded || !_webglTexture || !source) return;
        if (uniformsRef.current[`iChannel${index}`]?.isNeeded) {
          if (!shaderProgramRef.current) return;
          const iChannel = gl.getUniformLocation(shaderProgramRef.current, `iChannel${index}`);
          // @ts-expect-error TODO: Fix. Can't index WebGL context with this dynamic value.
          gl.activeTexture(gl[`TEXTURE${index}`]);
          gl.bindTexture(gl.TEXTURE_2D, _webglTexture);
          gl.uniform1i(iChannel, index);
          if (isVideo) {
            texture.updateTexture(_webglTexture, source as HTMLVideoElement, flipY);
          }
        }
      }
    }
  };

  const drawScene = (timestamp: number) => {
    const gl = glRef.current;
    if (!gl) return;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, squareVerticesBufferRef.current);
    gl.vertexAttribPointer(vertexPositionAttributeRef.current ?? 0, 3, gl.FLOAT, false, 0, 0);
    setUniforms(timestamp);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (uniformsRef.current.iMouse?.isNeeded && lerp !== 1) {
      // @ts-expect-error TODO: Deal with this.
      uniformsRef.current.iMouse.value[0] = lerpVal(
        // @ts-expect-error TODO: Deal with this.
        uniformsRef.current.iMouse.value[0],
        lastMouseArrRef.current[0],
        lerp
      );
      // @ts-expect-error TODO: Deal with this.
      uniformsRef.current.iMouse.value[1] = lerpVal(
        // @ts-expect-error TODO: Deal with this.
        uniformsRef.current.iMouse.value[1],
        lastMouseArrRef.current[1],
        lerp
      );
    }
    animFrameIdRef.current = requestAnimationFrame(drawScene);
  };

  const addEventListeners = () => {
    const options = { passive: true };
    if (uniformsRef.current.iMouse?.isNeeded && canvasRef.current) {
      canvasRef.current.addEventListener('mousemove', mouseMove, options);
      canvasRef.current.addEventListener('mouseout', mouseUp, options);
      canvasRef.current.addEventListener('mouseup', mouseUp, options);
      canvasRef.current.addEventListener('mousedown', mouseDown, options);
      canvasRef.current.addEventListener('touchmove', mouseMove, options);
      canvasRef.current.addEventListener('touchend', mouseUp, options);
      canvasRef.current.addEventListener('touchstart', mouseDown, options);
    }
    if (uniformsRef.current.iDeviceOrientation?.isNeeded) {
      window.addEventListener('deviceorientation', onDeviceOrientationChange, options);
    }
    if (canvasRef.current) {
      resizeObserverRef.current = new ResizeObserver(onResize);
      resizeObserverRef.current.observe(canvasRef.current);
      window.addEventListener('resize', onResize, options);
    }
  };

  const removeEventListeners = () => {
    const options = { passive: true } as EventListenerOptions;
    if (uniformsRef.current.iMouse?.isNeeded && canvasRef.current) {
      canvasRef.current.removeEventListener('mousemove', mouseMove, options);
      canvasRef.current.removeEventListener('mouseout', mouseUp, options);
      canvasRef.current.removeEventListener('mouseup', mouseUp, options);
      canvasRef.current.removeEventListener('mousedown', mouseDown, options);
      canvasRef.current.removeEventListener('touchmove', mouseMove, options);
      canvasRef.current.removeEventListener('touchend', mouseUp, options);
      canvasRef.current.removeEventListener('touchstart', mouseDown, options);
    }
    if (uniformsRef.current.iDeviceOrientation?.isNeeded) {
      window.removeEventListener('deviceorientation', onDeviceOrientationChange, options);
    }
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      window.removeEventListener('resize', onResize, options);
    }
  };

  useEffect(() => {
    propsUniformsRef.current = propUniforms;
  }, [propUniforms]);

  // Main effect for initialization and cleanup
  useEffect(() => {
    const textures = texturesArrRef.current;

    function init() {
      initWebGL();
      const gl = glRef.current;
      if (gl && canvasRef.current) {
        gl.clearColor(...clearColor);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.viewport(0, 0, canvasRef.current.width, canvasRef.current.height);
        console.log('canvasRef.current', canvasRef.current);
        console.log('canvasRef.current.width', canvasRef.current.width);
        console.log('canvasRef.current.height', canvasRef.current.height);
        canvasRef.current.height = canvasRef.current.clientHeight;
        canvasRef.current.width = canvasRef.current.clientWidth;
        processCustomUniforms();
        processTextures();
        initShaders(preProcessFragment(fs || BASIC_FS), vs || BASIC_VS);
        initBuffers();
        requestAnimationFrame(drawScene);
        addEventListeners();
        onResize();
      }
    }

    requestAnimationFrame(init);

    // Cleanup function
    return () => {
      const gl = glRef.current;
      if (gl) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        gl.useProgram(null);
        gl.deleteProgram(shaderProgramRef.current ?? null);
        if (textures.length > 0) {
          for (const texture of textures as Texture[]) {
            gl.deleteTexture(texture._webglTexture);
          }
        }
        shaderProgramRef.current = null;
      }
      removeEventListeners();
      cancelAnimationFrame(animFrameIdRef.current ?? 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only once on mount

  return (
    <canvas ref={canvasRef} style={{ height: '100%', width: '100%', ...style } as CSSProperties} />
  );
};
