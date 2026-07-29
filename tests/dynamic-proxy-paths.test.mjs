import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Next assets and bundled app resources use app-relative paths', async () => {
  const [nextConfig, rootLayout, appConfig, styles] = await Promise.all([
    readFile('next.config.ts', 'utf8'),
    readFile('app/layout.tsx', 'utf8'),
    readFile('app-config.ts', 'utf8'),
    readFile('styles/globals.css', 'utf8'),
  ]);

  assert.match(nextConfig, /assetPrefix:\s*['"]\.['"]/);
  assert.doesNotMatch(rootLayout, /next\/font/);
  assert.doesNotMatch(styles, /--font-commit-mono/);
  assert.match(appConfig, /logo:\s*['"]lk-logo\.png['"]/);
  assert.match(appConfig, /logoDark:\s*['"]lk-logo-dark\.png['"]/);
});

test('browser API requests stay under the current app entry path', async () => {
  const [dispatchClient, stopClient, useRoom] = await Promise.all([
    readFile('lib/session-dispatch-client.ts', 'utf8'),
    readFile('lib/session-stop-client.ts', 'utf8'),
    readFile('hooks/useRoom.ts', 'utf8'),
  ]);

  assert.match(dispatchClient, /fetch\(['"]api\/session\/dispatch['"]/);
  assert.match(stopClient, /fetch\(['"]api\/session\/stop['"]/);
  assert.match(useRoom, /NEXT_PUBLIC_CONN_DETAILS_ENDPOINT \?\? ['"]api\/connection-details['"]/);
  assert.match(useRoom, /window\.location\.href/);

  assert.equal(
    new URL('api/connection-details', 'http://127.0.0.1:4003/').pathname,
    '/api/connection-details'
  );
  assert.equal(
    new URL('api/connection-details', 'https://gateway.example/s/session-slug').pathname,
    '/s/api/connection-details'
  );
  assert.equal(
    new URL('api/connection-details', 'https://sandbox.example/api/v1/sandboxes/id/proxy/4003/')
      .pathname,
    '/api/v1/sandboxes/id/proxy/4003/api/connection-details'
  );
});
