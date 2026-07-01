import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const { resolveCameraPreviewTrack } = await import('../lib/video-preview-selection.ts');

test('explicit livekit selection does not fall back to the raw camera while the track is missing', () => {
  const previewTrack = resolveCameraPreviewTrack({
    selectedTrack: null,
    selectedTrackId: 'room_video',
    selectedTrackType: 'livekit',
    canShowDefaultCameraPreview: true,
    configuredCameraTrack: { id: 'room_video' },
    defaultCameraTrack: { id: 'browser_video_track' },
  });

  assert.equal(previewTrack, undefined);
});

test('auto preview may fall back to a configured camera before the user selects a track', () => {
  const configuredCameraTrack = { id: 'room_video' };
  const previewTrack = resolveCameraPreviewTrack({
    selectedTrack: null,
    selectedTrackId: null,
    selectedTrackType: null,
    canShowDefaultCameraPreview: true,
    configuredCameraTrack,
    defaultCameraTrack: { id: 'browser_video_track' },
  });

  assert.equal(previewTrack, configuredCameraTrack);
});

test('tile layout resolves camera preview through the shared helper', async () => {
  const source = await readFile('components/app/tile-layout.tsx', 'utf8');

  assert.match(source, /resolveCameraPreviewTrack/);
  assert.match(source, /selectedTrackType/);
});
