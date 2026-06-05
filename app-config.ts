export interface VideoTrackConfig {
  id: string;
  label: string;
  type: 'system' | 'livekit';
  livekitTrackName?: string; // LiveKit轨道名称（仅当type为'livekit'时使用）
  enabled: boolean;
  icon?: 'camera' | 'broadcast';
  description?: string;
}

export interface AppConfig {
  pageTitle: string;
  pageDescription: string;
  companyName: string;

  supportsChatInput: boolean;
  supportsVideoInput: boolean;
  supportsScreenShare: boolean;
  isPreConnectBufferEnabled: boolean;
  usesBrowserRawMediaInput?: boolean;
  usesServerRoomInput?: boolean;
  browserMediaStreamName?: string;
  browserVideoWidth?: number;
  browserVideoHeight?: number;
  browserVideoFps?: number;
  browserVideoMaxBitrate?: number;
  browserVideoStats?: boolean;
  remoteVideoWidth?: number;
  remoteVideoHeight?: number;
  remoteVideoFps?: number;

  logo: string;
  startButtonText: string;
  accent?: string;
  logoDark?: string;
  accentDark?: string;

  // for LiveKit Cloud Sandbox
  sandboxId?: string;
  agentName?: string;

  excludeAudioTracks: string[];
  showAudioFilterDebug?: boolean;
  debugAudio?: boolean;
  debugVideo?: boolean;

  // 全局调试配置
  enableGlobalDebug?: boolean; // 全局调试开关，控制所有调试信息的显示

  // 字幕和转录配置
  enableSmartParticipantMatching?: boolean; // 启用智能参与者匹配
  enableTranscriptionDebug?: boolean; // 启用转录调试日志
  showTranscriptByDefault?: boolean; // 默认显示字幕窗口
  userTranscriptionIdentities?: string[]; // 用户转录身份标识列表
  showParticipantNames?: boolean; // 是否显示参与者名称（user、agent-xxx等）

  // 视频轨道配置
  availableVideoTracks: VideoTrackConfig[];
  defaultVideoTrack?: string; // 默认选择的视频轨道ID
  showDefaultCameraPreview?: boolean; // 是否默认显示摄像头/视频输入预览
}

const ROOM_INPUT_AUDIO_TRACK_NAME = 'room_audio';
const ROOM_INPUT_VIDEO_TRACK_NAME = 'room_video';
const BROWSER_VIDEO_TRACK_NAME = 'browser_video_track';
export function buildDefaultVideoTracks(
  isBrowserInput: boolean,
  usesServerRoomInput = false
): VideoTrackConfig[] {
  const inputVideoTracks: VideoTrackConfig[] = [];

  if (isBrowserInput) {
    inputVideoTracks.push({
      id: BROWSER_VIDEO_TRACK_NAME,
      label: '原始摄像头视频',
      type: 'livekit',
      livekitTrackName: BROWSER_VIDEO_TRACK_NAME,
      enabled: true,
      icon: 'camera',
      description: '浏览器原始摄像头视频',
    });
  } else if (!usesServerRoomInput) {
    inputVideoTracks.push({
      id: 'system_camera_default',
      label: '系统默认摄像头',
      type: 'system',
      enabled: true,
      icon: 'camera',
      description: '系统默认摄像头设备',
    });
  }

  return [
    ...inputVideoTracks,
    {
      id: ROOM_INPUT_VIDEO_TRACK_NAME,
      label: '人脸检测频道',
      type: 'livekit' as const,
      livekitTrackName: ROOM_INPUT_VIDEO_TRACK_NAME,
      enabled: true,
      icon: 'broadcast' as const,
      description: '统一输入视频预览',
    },
  ];
}

export function getDefaultVideoTrack(): string {
  return ROOM_INPUT_VIDEO_TRACK_NAME;
}

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'Lexmount',
  pageTitle: 'Lexmount Voice Agent',
  pageDescription: 'A voice agent built with Lexmount Agent Studio',

  supportsChatInput: true,
  supportsVideoInput: true,
  supportsScreenShare: true,
  isPreConnectBufferEnabled: true,
  usesBrowserRawMediaInput: false,
  usesServerRoomInput: false,
  browserMediaStreamName: 'browser_input',
  browserVideoWidth: 640,
  browserVideoHeight: 480,
  browserVideoFps: 25,
  browserVideoMaxBitrate: 1700000,
  browserVideoStats: false,
  remoteVideoWidth: 640,
  remoteVideoHeight: 480,
  remoteVideoFps: 25,

  logo: '/lk-logo.png',
  accent: '#002cf2',
  logoDark: '/lk-logo-dark.png',
  accentDark: '#1fd5f9',
  startButtonText: 'Start call',

  // for LiveKit Cloud Sandbox
  sandboxId: undefined,
  agentName: undefined,

  // 音频过滤配置
  excludeAudioTracks: [ROOM_INPUT_AUDIO_TRACK_NAME], // 要排除的音频轨道名称列表

  // 调试配置
  showAudioFilterDebug: process.env.NEXT_PUBLIC_SHOW_AUDIO_DEBUG === 'true' || false, // 是否显示音频过滤调试组件
  debugAudio: false,
  debugVideo: false,

  // 全局调试配置
  enableGlobalDebug: process.env.NEXT_PUBLIC_ENABLE_GLOBAL_DEBUG === 'true' || false, // 全局调试开关

  // 字幕和转录配置
  enableSmartParticipantMatching: true, // 启用智能参与者匹配，解决自定义音频track的字幕显示问题
  enableTranscriptionDebug: process.env.NEXT_PUBLIC_SHOW_TRANSCRIPTION_DEBUG === 'true' || false, // 转录调试日志
  showTranscriptByDefault: true, // 默认显示字幕；文本输入栏由用户点击 text 按钮后展开
  userTranscriptionIdentities: ['room_audio_input'], // 用户转录身份标识（自定义音频track）
  showParticipantNames: false, // 默认不显示参与者名称（user、agent-xxx等）

  // 视频轨道配置
  showDefaultCameraPreview: true,
  availableVideoTracks: buildDefaultVideoTracks(false),
  defaultVideoTrack: getDefaultVideoTrack(), // 默认选择统一输入视频轨道
};
