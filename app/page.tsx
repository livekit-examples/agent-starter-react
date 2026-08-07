import { App } from '@/components/app/app';
import { getAppConfig } from '@/lib/utils';

export default async function Page() {
  const appConfig = await getAppConfig();

  return <App appConfig={appConfig} />;
}
