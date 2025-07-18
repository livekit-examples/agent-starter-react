import { headers } from 'next/headers';
import { ImageResponse } from 'next/og';
import getImageSize from 'buffer-image-size';
import mime from 'mime';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { APP_CONFIG_DEFAULTS } from '@/app-config';
import { getAppConfig, getOrigin } from '@/lib/utils';

type Dimensions = {
  width: number;
  height: number;
};

type ImageData = {
  base64: string;
  dimensions: Dimensions;
};

// Image metadata
export const alt = 'About Acme';
export const size = {
  width: 1200,
  height: 628,
};

function isUriLocalFile(uri: string) {
  return uri.startsWith('public/');
}

function isUriRemoteFile(uri: string) {
  return uri.startsWith('http');
}

function doesLocalFileExist(uri: string) {
  return isUriLocalFile(uri) && existsSync(join(process.cwd(), uri));
}

async function getImageData(uri: string, fallbackUri?: string): Promise<ImageData> {
  try {
    if (doesLocalFileExist(uri)) {
      const buffer = await readFile(join(process.cwd(), uri));
      const mimeType = mime.getType(uri);
      return {
        base64: `data:${mimeType};base64,${buffer.toString('base64')}`,
        dimensions: getImageSize(buffer),
      };
    }
    if (isUriRemoteFile(uri)) {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = mime.getType(uri);
      return {
        base64: `data:${mimeType};base64,${buffer.toString('base64')}`,
        dimensions: getImageSize(buffer),
      };
    }
    throw new Error(`Cannot load image: ${uri}`);
  } catch (e) {
    if (fallbackUri) {
      return getImageData(fallbackUri, fallbackUri);
    }
    throw e;
  }
}

function scaleImageSize(size: { width: number; height: number }, desiredHeight: number) {
  const scale = desiredHeight / size.height;
  return {
    width: size.width * scale,
    height: desiredHeight,
  };
}

function cleanAppName(appName: string) {
  return appName
    .split(' ')
    .filter((word) => word.toLocaleLowerCase() !== 'livekit')
    .join(' ');
}

export const contentType = 'image/png';

// Image generation
export default async function Image() {
  const hdrs = await headers();
  const origin = getOrigin(hdrs);
  const appConfig = await getAppConfig(origin);

  const appName = cleanAppName(appConfig.pageTitle);
  const logoUri = appConfig.logoDark || appConfig.logo;
  const wordmarkUri = logoUri === APP_CONFIG_DEFAULTS.logoDark ? 'public/lk-wordmark.svg' : logoUri;

  console.log('wordmarkUri', logoUri, APP_CONFIG_DEFAULTS.logoDark);

  // Font loading, process.cwd() is Next.js project directory
  // const interSemiBold = await readFile(join(process.cwd(), 'assets/Inter-SemiBold.ttf'));

  // bg
  const { base64: bgSrcBase64 } = await getImageData('public/opengraph-image-bg.png');

  // wordmark
  const { base64: wordmarkSrcBase64, dimensions: wordmarkDimensions } =
    await getImageData(wordmarkUri);
  const wordmarkSize = scaleImageSize(wordmarkDimensions, 32);

  // logo
  const { base64: logoSrcBase64, dimensions: logoDimensions } = await getImageData(
    logoUri,
    'public/lk-logo-dark.svg'
  );
  const logoSize = scaleImageSize(logoDimensions, 24);

  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size.width,
          height: size.height,
          backgroundImage: `url(${bgSrcBase64})`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* wordmark */}
        <div
          style={{
            position: 'absolute',
            top: 30,
            left: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <img src={wordmarkSrcBase64} width={wordmarkSize.width} height={wordmarkSize.height} />
        </div>
        {/* logo */}
        <div
          style={{
            position: 'absolute',
            top: 200,
            left: 460,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <img src={logoSrcBase64} width={logoSize.width} height={logoSize.height} />
        </div>
        {/* title */}
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            left: 30,
            width: '380px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              backgroundColor: '#1F1F1F',
              color: '#999999',
              padding: '2px 8px',
              borderRadius: 4,
              width: 72,
            }}
          >
            SANDBOX
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 600,
              color: 'white',
              lineHeight: 1,
            }}
          >
            {appName
              .split(' ')
              .filter((word) => word.toLocaleLowerCase() !== 'livekit')
              .join(' ')}
          </div>
        </div>
      </div>
    ),
    // ImageResponse options
    {
      // For convenience, we can re-use the exported opengraph-image
      // size config to also set the ImageResponse's width and height.
      ...size,
      // fonts: [
      //   {
      //     name: 'Inter',
      //     data: interSemiBold,
      //     style: 'normal',
      //     weight: 400,
      //   },
      // ],
    }
  );
}
