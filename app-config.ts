export interface AppConfig {
  pageTitle: string;
  pageDescription: string;
  companyName: string;

  supportsChatInput: boolean;
  supportsVideoInput: boolean;
  supportsScreenShare: boolean;
  isPreConnectBufferEnabled: boolean;

  logo: string;
  startButtonText: string;
  accent?: string;
  logoDark?: string;
  accentDark?: string;

  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  audioVisualizerColor?: `#${string}`;
  audioVisualizerColorDark?: `#${string}`;
  audioVisualizerColorShift?: number;
  audioVisualizerBarCount?: number;
  audioVisualizerGridRowCount?: number;
  audioVisualizerGridColumnCount?: number;
  audioVisualizerRadialBarCount?: number;
  audioVisualizerRadialRadius?: number;
  audioVisualizerWaveLineWidth?: number;

  // agent dispatch configuration
  agentName?: string;

  // LiveKit Cloud Sandbox configuration
  sandboxId?: string;
}

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: process.env.COMPANY ?? 'Портал',
  pageTitle: process.env.TITLE ?? 'Портал Агенты',
  pageDescription: process.env.DESCRIPTION ?? 'Портал ИИ-агенты',

  supportsChatInput: true,
  supportsVideoInput: true,
  supportsScreenShare: true,
  isPreConnectBufferEnabled: true,

  logo: '/lk-logo.svg',
  accent: '#b10ed6ff',
  logoDark: '/lk-logo-dark.svg',
  accentDark: 'rgb(154, 6, 183)',
  startButtonText: process.env.BUTTON ?? 'Открыть Портал',

  // optional: audio visualization configuration
  audioVisualizerColor: '#9f0676',
  audioVisualizerColorDark: '#f91fdf',
  audioVisualizerType: 'bar',
  audioVisualizerBarCount: 5,
  //audioVisualizerType: 'radial',
  //audioVisualizerRadialBarCount: 24,
  //audioVisualizerRadialRadius: 100,
  //audioVisualizerType: 'grid',
  //audioVisualizerGridRowCount: 25,
  //audioVisualizerGridColumnCount: 25,
  //audioVisualizerType: 'wave',
  //audioVisualizerWaveLineWidth: 3,
  //audioVisualizerType: 'aura',
  audioVisualizerColorShift: 0.3,

  // agent dispatch configuration
  agentName: process.env.AGENT_NAME ?? undefined,
  //agentName: 'portal', agentName: undefined,

  // LiveKit Cloud Sandbox configuration
  sandboxId: undefined,
};
