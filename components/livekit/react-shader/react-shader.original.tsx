import { type CSSProperties, Component } from 'react';
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
export class Shader extends Component<Props, unknown> {
  uniforms: Record<
    string,
    { type: string; isNeeded: boolean; value?: number[] | number; arraySize?: string }
  >;
  constructor(props: Props) {
    super(props);
    this.uniforms = {
      [UNIFORM_TIME]: { type: 'float', isNeeded: false, value: 0 },
      [UNIFORM_TIMEDELTA]: { type: 'float', isNeeded: false, value: 0 },
      [UNIFORM_DATE]: { type: 'vec4', isNeeded: false, value: [0, 0, 0, 0] },
      [UNIFORM_MOUSE]: { type: 'vec4', isNeeded: false, value: [0, 0, 0, 0] },
      [UNIFORM_RESOLUTION]: { type: 'vec2', isNeeded: false, value: [0, 0] },
      [UNIFORM_FRAME]: { type: 'int', isNeeded: false, value: 0 },
      [UNIFORM_DEVICEORIENTATION]: { type: 'vec4', isNeeded: false, value: [0, 0, 0, 0] },
    };
  }
  static defaultProps = {
    textures: [],
    contextAttributes: {},
    devicePixelRatio: 1,
    vs: BASIC_VS,
    precision: 'highp',
    onError: console.error,
    onWarn: console.warn,
  };
  componentDidMount = () => {
    this.initWebGL();
    const { fs, vs, clearColor = [0, 0, 0, 1] } = this.props;
    const { gl } = this;
    if (gl && this.canvas) {
      gl.clearColor(...clearColor);
      gl.clearDepth(1.0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.canvas.height = this.canvas.clientHeight;
      this.canvas.width = this.canvas.clientWidth;
      this.processCustomUniforms();
      this.processTextures();
      this.initShaders(this.preProcessFragment(fs || BASIC_FS), vs || BASIC_VS);
      this.initBuffers();
      requestAnimationFrame(this.drawScene);
      this.addEventListeners();
      this.onResize();
    }
  };
  shouldComponentUpdate = () => false;
  componentWillUnmount() {
    const { gl } = this;
    if (gl) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      gl.useProgram(null);
      gl.deleteProgram(this.shaderProgram ?? null);
      if (this.texturesArr.length > 0) {
        for (const texture of this.texturesArr as Texture[]) {
          gl.deleteTexture(texture._webglTexture);
        }
      }
      this.shaderProgram = null;
    }
    this.removeEventListeners();
    cancelAnimationFrame(this.animFrameId ?? 0);
  }
  setupChannelRes = ({ width, height }: Texture, id: number) => {
    const { devicePixelRatio = 1 } = this.props;
    // @ts-expect-error TODO: Deal with this.
    this.uniforms.iChannelResolution.value[id * 3] = width * devicePixelRatio;
    // @ts-expect-error TODO: Deal with this.
    this.uniforms.iChannelResolution.value[id * 3 + 1] = height * devicePixelRatio;
    // @ts-expect-error TODO: Deal with this.
    this.uniforms.iChannelResolution.value[id * 3 + 2] = 0;
    // console.log(this.uniforms);
  };
  initWebGL = () => {
    const { contextAttributes } = this.props;
    if (!this.canvas) return;
    this.gl = (this.canvas.getContext('webgl', contextAttributes) ||
      this.canvas.getContext(
        'experimental-webgl',
        contextAttributes
      )) as WebGLRenderingContext | null;
    this.gl?.getExtension('OES_standard_derivatives');
    this.gl?.getExtension('EXT_shader_texture_lod');
  };
  initBuffers = () => {
    const { gl } = this;
    this.squareVerticesBuffer = gl?.createBuffer();
    gl?.bindBuffer(gl.ARRAY_BUFFER, this.squareVerticesBuffer ?? null);
    const vertices = [1.0, 1.0, 0.0, -1.0, 1.0, 0.0, 1.0, -1.0, 0.0, -1.0, -1.0, 0.0];
    gl?.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  };
  addEventListeners = () => {
    const options = { passive: true };
    if (this.uniforms.iMouse?.isNeeded && this.canvas) {
      this.canvas.addEventListener('mousemove', this.mouseMove, options);
      this.canvas.addEventListener('mouseout', this.mouseUp, options);
      this.canvas.addEventListener('mouseup', this.mouseUp, options);
      this.canvas.addEventListener('mousedown', this.mouseDown, options);
      this.canvas.addEventListener('touchmove', this.mouseMove, options);
      this.canvas.addEventListener('touchend', this.mouseUp, options);
      this.canvas.addEventListener('touchstart', this.mouseDown, options);
    }
    if (this.uniforms.iDeviceOrientation?.isNeeded) {
      window.addEventListener('deviceorientation', this.onDeviceOrientationChange, options);
    }
    if (this.canvas) {
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(this.canvas);
    }
  };
  removeEventListeners = () => {
    const options = { passive: true } as EventListenerOptions;
    if (this.uniforms.iMouse?.isNeeded && this.canvas) {
      this.canvas.removeEventListener('mousemove', this.mouseMove, options);
      this.canvas.removeEventListener('mouseout', this.mouseUp, options);
      this.canvas.removeEventListener('mouseup', this.mouseUp, options);
      this.canvas.removeEventListener('mousedown', this.mouseDown, options);
      this.canvas.removeEventListener('touchmove', this.mouseMove, options);
      this.canvas.removeEventListener('touchend', this.mouseUp, options);
      this.canvas.removeEventListener('touchstart', this.mouseDown, options);
    }
    if (this.uniforms.iDeviceOrientation?.isNeeded) {
      window.removeEventListener('deviceorientation', this.onDeviceOrientationChange, options);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  };
  onDeviceOrientationChange = ({ alpha, beta, gamma }: DeviceOrientationEvent) => {
    this.uniforms.iDeviceOrientation.value = [
      alpha ?? 0,
      beta ?? 0,
      gamma ?? 0,
      window.orientation || 0,
    ];
  };
  mouseDown = (e: MouseEvent | TouchEvent) => {
    const [clientX, clientY] = latestPointerClientCoords(e);
    const mouseX = clientX - (this.canvasPosition?.left ?? 0) - window.pageXOffset;
    const mouseY =
      (this.canvasPosition?.height ?? 0) -
      clientY -
      (this.canvasPosition?.top ?? 0) -
      window.pageYOffset;
    this.mousedown = true;
    // @ts-expect-error TODO: Deal with this.
    this.uniforms.iMouse.value[2] = mouseX;
    // @ts-expect-error TODO: Deal with this.
    this.uniforms.iMouse.value[3] = mouseY;
    this.lastMouseArr[0] = mouseX;
    this.lastMouseArr[1] = mouseY;
  };
  mouseMove = (e: MouseEvent | TouchEvent) => {
    this.canvasPosition = this.canvas?.getBoundingClientRect();
    const { lerp = 1 } = this.props;
    const [clientX, clientY] = latestPointerClientCoords(e);
    const mouseX = clientX - (this.canvasPosition?.left ?? 0);
    const mouseY = (this.canvasPosition?.height ?? 0) - clientY - (this.canvasPosition?.top ?? 0);
    if (lerp !== 1) {
      this.lastMouseArr[0] = mouseX;
      this.lastMouseArr[1] = mouseY;
    } else {
      // @ts-expect-error TODO: Deal with this.
      this.uniforms.iMouse.value[0] = mouseX;
      // @ts-expect-error TODO: Deal with this.
      this.uniforms.iMouse.value[1] = mouseY;
    }
  };
  mouseUp = () => {
    // @ts-expect-error TODO: Deal with this.
    this.uniforms.iMouse.value[2] = 0;
    // @ts-expect-error TODO: Deal with this.
    this.uniforms.iMouse.value[3] = 0;
  };
  onResize = () => {
    const { gl } = this;
    const { devicePixelRatio = 1 } = this.props;
    if (!gl) return;
    this.canvasPosition = this.canvas?.getBoundingClientRect();
    // Force pixel ratio to be one to avoid expensive calculus on retina display.
    const realToCSSPixels = devicePixelRatio;
    const displayWidth = Math.floor((this.canvasPosition?.width ?? 1) * realToCSSPixels);
    const displayHeight = Math.floor((this.canvasPosition?.height ?? 1) * realToCSSPixels);
    gl.canvas.width = displayWidth;
    gl.canvas.height = displayHeight;
    if (this.uniforms.iResolution?.isNeeded && this.shaderProgram) {
      const rUniform = gl.getUniformLocation(this.shaderProgram, UNIFORM_RESOLUTION);
      gl.uniform2fv(rUniform, [gl.canvas.width, gl.canvas.height]);
    }
  };
  drawScene = (timestamp: number) => {
    const { gl } = this;
    const { lerp = 1 } = this.props;
    if (!gl) return;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.squareVerticesBuffer ?? null);
    gl.vertexAttribPointer(this.vertexPositionAttribute ?? 0, 3, gl.FLOAT, false, 0, 0);
    this.setUniforms(timestamp);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (this.uniforms.iMouse?.isNeeded && lerp !== 1) {
      // @ts-expect-error TODO: Deal with this.
      this.uniforms.iMouse.value[0] = lerpVal(
        // @ts-expect-error TODO: Deal with this.
        this.uniforms.iMouse.value[0],
        this.lastMouseArr[0],
        lerp
      );
      // @ts-expect-error TODO: Deal with this.
      this.uniforms.iMouse.value[1] = lerpVal(
        // @ts-expect-error TODO: Deal with this.
        this.uniforms.iMouse.value[1],
        this.lastMouseArr[1],
        lerp
      );
    }
    this.animFrameId = requestAnimationFrame(this.drawScene);
  };
  createShader = (type: number, shaderCodeAsText: string) => {
    const { gl } = this;
    if (!gl) return null;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, shaderCodeAsText);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      this.props.onWarning?.(log(`Error compiling the shader:\n${shaderCodeAsText}`));
      const compilationLog = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      this.props.onError?.(log(`Shader compiler log: ${compilationLog}`));
    }
    return shader;
  };
  initShaders = (fs: string, vs: string) => {
    const { gl } = this;
    if (!gl) return;
    // console.log(fs, vs);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fs);
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vs);
    this.shaderProgram = gl.createProgram();
    if (!this.shaderProgram || !vertexShader || !fragmentShader) return;
    gl.attachShader(this.shaderProgram, vertexShader);
    gl.attachShader(this.shaderProgram, fragmentShader);
    gl.linkProgram(this.shaderProgram);
    if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)) {
      this.props.onError?.(
        log(`Unable to initialize the shader program: ${gl.getProgramInfoLog(this.shaderProgram)}`)
      );
      return;
    }
    gl.useProgram(this.shaderProgram);
    this.vertexPositionAttribute = gl.getAttribLocation(this.shaderProgram, 'aVertexPosition');
    gl.enableVertexAttribArray(this.vertexPositionAttribute);
  };
  processCustomUniforms = () => {
    const { uniforms } = this.props;
    if (uniforms) {
      for (const name of Object.keys(uniforms)) {
        const uniform = this.props.uniforms?.[name];
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
        this.uniforms[name] = { type: glslType, isNeeded: false, value, ...tempObject };
      }
    }
  };
  processTextures = () => {
    const { gl } = this;
    const { textures, onDoneLoadingTextures } = this.props;
    if (!gl) return;
    if (textures && textures.length > 0) {
      this.uniforms[`${UNIFORM_CHANNELRESOLUTION}`] = {
        type: 'vec3',
        isNeeded: false,
        arraySize: `[${textures.length}]`,
        value: [],
      };
      const texturePromisesArr = textures.map((texture: TextureParams, id: number) => {
        // Dynamically add textures uniforms.
        this.uniforms[`${UNIFORM_CHANNEL}${id}`] = {
          type: 'sampler2D',
          isNeeded: false,
        };
        // Initialize array with 0s:
        // @ts-expect-error TODO: Deal with this.
        this.setupChannelRes(texture, id);
        this.texturesArr[id] = new Texture(gl);
        return (
          this.texturesArr[id]
            // @ts-expect-error TODO: Deal with this.
            ?.load(texture, id)
            .then((t: Texture) => {
              this.setupChannelRes(t, id);
            })
        );
      });
      Promise.all(texturePromisesArr)
        .then(() => {
          if (onDoneLoadingTextures) onDoneLoadingTextures();
        })
        .catch((e) => {
          this.props.onError?.(e);
          if (onDoneLoadingTextures) onDoneLoadingTextures();
        });
    } else if (onDoneLoadingTextures) onDoneLoadingTextures();
  };
  preProcessFragment = (fragment: string) => {
    const { precision, devicePixelRatio = 1 } = this.props;
    const isValidPrecision = PRECISIONS.includes(precision ?? 'highp');
    const precisionString = `precision ${isValidPrecision ? precision : PRECISIONS[1]} float;\n`;
    if (!isValidPrecision) {
      this.props.onWarning?.(
        log(
          `wrong precision type ${precision}, please make sure to pass one of a valid precision lowp, mediump, highp, by default you shader precision will be set to highp.`
        )
      );
    }
    let fs = precisionString
      .concat(`#define DPR ${devicePixelRatio.toFixed(1)}\n`)
      .concat(fragment.replace(/texture\(/g, 'texture2D('));
    for (const uniform of Object.keys(this.uniforms)) {
      if (fragment.includes(uniform)) {
        const u = this.uniforms[uniform];
        if (!u) continue;
        fs = insertStringAtIndex(
          fs,
          `uniform ${u.type} ${uniform}${u.arraySize || ''}; \n`,
          fs.lastIndexOf(precisionString) + precisionString.length
        );
        u.isNeeded = true;
      }
    }
    const isShadertoy = fragment.includes('mainImage');
    if (isShadertoy) fs = fs.concat(FS_MAIN_SHADER);
    return fs;
  };
  setUniforms = (timestamp: number) => {
    const { gl } = this;
    if (!gl || !this.shaderProgram) return;
    const delta = this.lastTime ? (timestamp - this.lastTime) / 1000 : 0;
    this.lastTime = timestamp;
    if (this.props.uniforms) {
      for (const name of Object.keys(this.props.uniforms)) {
        const currentUniform = this.props.uniforms?.[name];
        if (!currentUniform) return;
        if (this.uniforms[name]?.isNeeded) {
          if (!this.shaderProgram) return;
          const customUniformLocation = gl.getUniformLocation(this.shaderProgram, name);
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
    if (this.uniforms.iMouse?.isNeeded) {
      const mouseUniform = gl.getUniformLocation(this.shaderProgram, UNIFORM_MOUSE);
      gl.uniform4fv(mouseUniform, this.uniforms.iMouse.value as number[]);
    }
    if (this.uniforms.iChannelResolution?.isNeeded) {
      const channelResUniform = gl.getUniformLocation(
        this.shaderProgram,
        UNIFORM_CHANNELRESOLUTION
      );
      gl.uniform3fv(channelResUniform, this.uniforms.iChannelResolution.value as number[]);
    }
    if (this.uniforms.iDeviceOrientation?.isNeeded) {
      const deviceOrientationUniform = gl.getUniformLocation(
        this.shaderProgram,
        UNIFORM_DEVICEORIENTATION
      );
      gl.uniform4fv(deviceOrientationUniform, this.uniforms.iDeviceOrientation.value as number[]);
    }
    if (this.uniforms.iTime?.isNeeded) {
      const timeUniform = gl.getUniformLocation(this.shaderProgram, UNIFORM_TIME);
      gl.uniform1f(timeUniform, (this.timer += delta));
    }
    if (this.uniforms.iTimeDelta?.isNeeded) {
      const timeDeltaUniform = gl.getUniformLocation(this.shaderProgram, UNIFORM_TIMEDELTA);
      gl.uniform1f(timeDeltaUniform, delta);
    }
    if (this.uniforms.iDate?.isNeeded) {
      const d = new Date();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const year = d.getFullYear();
      const time =
        d.getHours() * 60 * 60 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() * 0.001;
      const dateUniform = gl.getUniformLocation(this.shaderProgram, UNIFORM_DATE);
      gl.uniform4fv(dateUniform, [year, month, day, time]);
    }
    if (this.uniforms.iFrame?.isNeeded) {
      const timeDeltaUniform = gl.getUniformLocation(this.shaderProgram, UNIFORM_FRAME);
      gl.uniform1i(timeDeltaUniform, (this.uniforms.iFrame.value as number)++);
    }
    if (this.texturesArr.length > 0) {
      for (let index = 0; index < this.texturesArr.length; index++) {
        // TODO: Don't use this casting if possible:
        const texture = this.texturesArr[index] as Texture | undefined;
        if (!texture) return;
        const { isVideo, _webglTexture, source, flipY, isLoaded } = texture;
        if (!isLoaded || !_webglTexture || !source) return;
        if (this.uniforms[`iChannel${index}`]?.isNeeded) {
          if (!this.shaderProgram) return;
          const iChannel = gl.getUniformLocation(this.shaderProgram, `iChannel${index}`);
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
  registerCanvas = (r: HTMLCanvasElement) => {
    this.canvas = r;
  };
  gl?: WebGLRenderingContext | null;
  squareVerticesBuffer?: WebGLBuffer | null;
  shaderProgram?: WebGLProgram | null;
  vertexPositionAttribute?: number;
  animFrameId?: number;
  canvas?: HTMLCanvasElement;
  mousedown = false;
  canvasPosition?: DOMRect;
  timer = 0;
  lastMouseArr: number[] = [0, 0];
  texturesArr: WebGLTexture[] = [];
  lastTime = 0;
  resizeObserver?: ResizeObserver;
  render = () => (
    <canvas
      ref={this.registerCanvas}
      style={{ height: '100%', width: '100%', ...this.props.style } as CSSProperties}
    />
  );
}
