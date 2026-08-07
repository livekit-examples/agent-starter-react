import { App } from '@/components/app/app';

export default function Page() {
  return <App agentName={process.env.AGENT_NAME} />;
}
