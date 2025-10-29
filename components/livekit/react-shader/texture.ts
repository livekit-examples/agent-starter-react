import { log } from './logging';

export const LinearFilter = 9729;
export const NearestFilter = 9728;
export const LinearMipMapLinearFilter = 9987;
export const NearestMipMapLinearFilter = 9986;
export const LinearMipMapNearestFilter = 9985;
export const NearestMipMapNearestFilter = 9984;
export const MirroredRepeatWrapping = 33648;
export const ClampToEdgeWrapping = 33071;
export const RepeatWrapping = 10497;

export class Texture {
  gl: WebGLRenderingContext;
  url?: string;
  wrapS?: number;
  wrapT?: number;
  minFilter?: number;
  magFilter?: number;
  source?: HTMLImageElement | HTMLVideoElement;
  pow2canvas?: HTMLCanvasElement;
  isLoaded = false;
  isVideo = false;
  flipY = -1;
  width = 0;
  height = 0;
  _webglTexture: WebGLTexture | null = null;
  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
  }
  updateTexture = (texture: WebGLTexture, video: HTMLVideoElement, flipY: number) => {
    const { gl } = this;
    const level = 0;
    const internalFormat = gl.RGBA;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, video);
  };
  setupVideo = (url: string) => {
    const video = document.createElement('video');
    let playing = false;
    let timeupdate = false;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.crossOrigin = 'anonymous';
    const checkReady = () => {
      if (playing && timeupdate) {
        this.isLoaded = true;
      }
    };
    video.addEventListener(
      'playing',
      () => {
        playing = true;
        this.width = video.videoWidth || 0;
        this.height = video.videoHeight || 0;
        checkReady();
      },
      true
    );
    video.addEventListener(
      'timeupdate',
      () => {
        timeupdate = true;
        checkReady();
      },
      true
    );
    video.src = url;
    // video.play(); // Not sure why this is here nor commented out. From STR.
    return video;
  };
  makePowerOf2 = <T extends HTMLCanvasElement | HTMLImageElement | ImageBitmap>(image: T): T => {
    if (
      image instanceof HTMLImageElement ||
      image instanceof HTMLCanvasElement ||
      image instanceof ImageBitmap
    ) {
      if (this.pow2canvas === undefined) this.pow2canvas = document.createElement('canvas');
      this.pow2canvas.width = 2 ** Math.floor(Math.log(image.width) / Math.LN2);
      this.pow2canvas.height = 2 ** Math.floor(Math.log(image.height) / Math.LN2);
      const context = this.pow2canvas.getContext('2d');
      context?.drawImage(image, 0, 0, this.pow2canvas.width, this.pow2canvas.height);
      console.warn(
        log(
          `Image is not power of two ${image.width} x ${image.height}. Resized to ${this.pow2canvas.width} x ${this.pow2canvas.height};`
        )
      );
      return this.pow2canvas as T;
    }
    return image;
  };
  load = async (
    textureArgs: Texture
    // channelId: number // Not sure why this is here nor commented out. From STR.
  ) => {
    const { gl } = this;
    const { url, wrapS, wrapT, minFilter, magFilter, flipY = -1 }: Texture = textureArgs;
    if (!url) {
      return Promise.reject(
        new Error(log('Missing url, please make sure to pass the url of your texture { url: ... }'))
      );
    }
    const isImage = /(\.jpg|\.jpeg|\.png|\.gif|\.bmp)$/i.exec(url);
    const isVideo = /(\.mp4|\.3gp|\.webm|\.ogv)$/i.exec(url);
    if (isImage === null && isVideo === null) {
      return Promise.reject(
        new Error(log(`Please upload a video or an image with a valid format (url: ${url})`))
      );
    }
    Object.assign(this, { url, wrapS, wrapT, minFilter, magFilter, flipY });
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([255, 255, 255, 0]);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      width,
      height,
      border,
      srcFormat,
      srcType,
      pixel
    );
    if (isVideo) {
      const video = this.setupVideo(url);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      this._webglTexture = texture;
      this.source = video;
      this.isVideo = true;
      return video.play().then(() => this);
    }
    async function loadImage() {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          resolve(image);
        };
        image.onerror = () => {
          reject(new Error(log(`failed loading url: ${url}`)));
        };
        image.src = url ?? '';
      });
    }
    let image = (await loadImage()) as HTMLImageElement;
    let isPowerOf2 =
      (image.width & (image.width - 1)) === 0 && (image.height & (image.height - 1)) === 0;
    if (
      (textureArgs.wrapS !== ClampToEdgeWrapping ||
        textureArgs.wrapT !== ClampToEdgeWrapping ||
        (textureArgs.minFilter !== NearestFilter && textureArgs.minFilter !== LinearFilter)) &&
      !isPowerOf2
    ) {
      image = this.makePowerOf2(image);
      isPowerOf2 = true;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);
    if (
      isPowerOf2 &&
      textureArgs.minFilter !== NearestFilter &&
      textureArgs.minFilter !== LinearFilter
    ) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrapS || RepeatWrapping);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.wrapT || RepeatWrapping);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      this.minFilter || LinearMipMapLinearFilter
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.magFilter || LinearFilter);
    this._webglTexture = texture;
    this.source = image;
    this.isVideo = false;
    this.isLoaded = true;
    this.width = image.width || 0;
    this.height = image.height || 0;
    return this;
  };
}
