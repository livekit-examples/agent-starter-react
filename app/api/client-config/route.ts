import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAppConfig } from '@/lib/utils';

export const revalidate = 0;

export async function GET() {
  const hdrs = await headers();

  return NextResponse.json(await getAppConfig(hdrs), {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
