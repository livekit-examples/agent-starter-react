import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Image metadata
export const alt = 'About Acme';
export const size = {
  width: 1200,
  height: 628,
};

export const contentType = 'image/png';

// Image generation
export default async function Image() {
  // Font loading, process.cwd() is Next.js project directory
  // const interSemiBold = await readFile(join(process.cwd(), 'assets/Inter-SemiBold.ttf'));

  // bg
  const bgData = await readFile(join(process.cwd(), 'public/opengraph-image-bg.png'));
  const bgSrc = Uint8Array.from(bgData).buffer;
  const bgSrcBase64 = `data:image/png;base64,${Buffer.from(bgSrc).toString('base64')}`;

  // wordmark
  const wordmarkData = await readFile(join(process.cwd(), 'public/lk-wordmark.png'));
  const wordmarkSrc = Uint8Array.from(wordmarkData).buffer;
  const wordmarkSrcBase64 = `data:image/png;base64,${Buffer.from(wordmarkSrc).toString('base64')}`;

  // logo
  const logoData = await readFile(join(process.cwd(), 'public/lk-logo-dark.svg'));
  const logoSrc = Uint8Array.from(logoData).buffer;
  const logoSrcBase64 = `data:image/svg+xml;base64,${Buffer.from(logoSrc).toString('base64')}`;

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
          <img src={wordmarkSrcBase64} width="143px" height="32px" />
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
          <img src={logoSrcBase64} width="24px" height="24px" />
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
            }}
          >
            Voice agent
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
