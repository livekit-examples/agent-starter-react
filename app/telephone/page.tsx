import { headers } from 'next/headers';
import { AppTelephone } from '@/components/app/app-telephone';
import { getAppConfig } from '@/lib/utils';

export default async function TelephonePage() {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return <AppTelephone appConfig={appConfig} />;
}
