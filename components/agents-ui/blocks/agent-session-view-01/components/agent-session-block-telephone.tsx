'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { AnimatePresence, type MotionProps, motion } from 'motion/react';
import { DataPacket_Kind } from 'livekit-client';
import { useAgent, useSessionContext, useSessionMessages, type AgentState } from '@livekit/components-react';
import { useRoomContext } from '@livekit/components-react';
import { AgentChatTranscript } from '@/components/agents-ui/agent-chat-transcript';
import {
  AgentControlBar,
  type AgentControlBarControls,
} from '@/components/agents-ui/agent-control-bar-telephone';
import { VoiceCharacterButton } from '@/components/agents-ui/voice-character-button';
import { useVoiceContext } from '@/components/agents-ui/voice-context';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { cn } from '@/lib/shadcn/utils';
import { TileLayout } from './tile-view';

// 静音模式下旁路消息的数据结构
interface MuteTextMessage {
  id: string;
  text: string;
  isDelta: boolean;
  timestamp: number;
  isUser: boolean;
}

// 串行化任务队列的数据结构
interface QueueTask {
  id: string;
  type: 'chat' | 'tool';
  title?: string;
  status?: string;
  sourceText: string;     // 存放网络上收到的流式源文本
  displayedText: string;  // 存放当前打字机已经吐在屏幕上的文本
  isFinished: boolean;     // 标记该阶段报文是否已全部接收完毕
  toolStartTime?: number; // 工具开始时间，用于合并排序
}

const MotionMessage = motion.create(Shimmer);

const BOTTOM_VIEW_MOTION_PROPS: MotionProps = {
  variants: { visible: { opacity: 1, translateY: '0%' }, hidden: { opacity: 0, translateY: '100%' } },
  initial: 'hidden', animate: 'visible', exit: 'hidden', transition: { duration: 0.3, delay: 0.5, ease: 'easeOut' },
};

const CHAT_MOTION_PROPS: MotionProps = {
  variants: {
    hidden: { opacity: 0, transition: { ease: 'easeOut', duration: 0.3 } },
    visible: { opacity: 1, transition: { delay: 0.2, ease: 'easeOut', duration: 0.3 } },
  },
  initial: 'hidden', animate: 'visible', exit: 'hidden',
};

const SHIMMER_MOTION_PROPS: MotionProps = {
  variants: {
    visible: { opacity: 1, transition: { ease: 'easeIn', duration: 0.5, delay: 0.8 } },
    hidden: { opacity: 0, transition: { ease: 'easeIn', duration: 0.5, delay: 0 } },
  },
  initial: 'hidden', animate: 'visible', exit: 'hidden',
};

export function Fade({ top = false, bottom = false, className }: { top?: boolean; bottom?: boolean; className?: string }) {
  return (
    <div className={cn('from-background pointer-events-none h-4 bg-linear-to-b to-transparent', top && 'bg-linear-to-b', bottom && 'bg-linear-to-t', className)} />
  );
}

export interface AgentSessionView_01Props {
  preConnectMessage?: string;
  supportsChatInput?: boolean;
  supportsVideoInput?: boolean;
  supportsScreenShare?: boolean;
  isPreConnectBufferEnabled?: boolean;
  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  audioVisualizerColor?: `#${string}`;
  audioVisualizerColorShift?: number;
  audioVisualizerBarCount?: number;
  audioVisualizerGridRowCount?: number;
  audioVisualizerGridColumnCount?: number;
  audioVisualizerRadialBarCount?: number;
  audioVisualizerRadialRadius?: number;
  audioVisualizerWaveLineWidth?: number;
  className?: string;
}

export function AgentSessionView_01Telephone({
  preConnectMessage = 'Agent is listening, ask it a question',
  supportsChatInput = true,
  supportsVideoInput = true,
  supportsScreenShare = true,
  isPreConnectBufferEnabled = true,
  audioVisualizerType,
  audioVisualizerColor,
  audioVisualizerColorShift,
  audioVisualizerBarCount,
  audioVisualizerGridRowCount,
  audioVisualizerGridColumnCount,
  audioVisualizerRadialBarCount,
  audioVisualizerRadialRadius,
  audioVisualizerWaveLineWidth,
  ref,
  className,
  ...props
}: React.ComponentProps<'section'> & AgentSessionView_01Props) {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session); // Livekit 原生的 pipeline 消息
  const [chatOpen, setChatOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { state: agentState } = useAgent();
  const room = useRoomContext();
  const { currentVoice } = useVoiceContext();

  const [customMessages, setCustomMessages] = useState<MuteTextMessage[]>([]);
  const [isMuteMode, setIsMuteMode] = useState(false);
  const [isMuteSpeaking, setIsMuteSpeaking] = useState(false);

  // 串行打字机核心引脚：任务队列、播放指针、主调度定时器
  const taskQueueRef = useRef<QueueTask[]>([]);
  const currentTaskIndexRef = useRef<number>(-1);
  const schedulerTimerRef = useRef<NodeJS.Timeout | null>(null);

  const effectiveAgentState: AgentState = isMuteSpeaking ? 'speaking' : agentState;

  const displayMessages = useMemo(() => {
    const customReceivedMessages = customMessages.map(m => {

      // A. 判断如果是工具卡片类型消息
      if (m.id.startsWith('mute-tool-')) {
        const task = taskQueueRef.current.find(t => t.id === m.id);
        const isFinished = task ? task.isFinished : false;
        const rawContent = task ? task.displayedText : '';
        const trimmedContent = rawContent.trim();

        // 🌟 优化 1：过滤无意义的空卡片。如果工具运行结束且无终端输出（如 read 技能），直接隐藏
        if (isFinished && !trimmedContent) {
          return null;
        }

        // 🌟 优化 2：智能美化工具标题，提升视觉体验
        const cleanTitle = (title?: string) => {
          if (!title) return '执行系统任务';
          return title
            .replace(/^read from .*?\/skills\//i, '读取配置 ')
            .replace(/^(command|exec) run node script .*?\/skills\//i, '执行脚本 ')
            .replace(/^(command|exec) run node script /i, '运行脚本 ')
            .replace(/^web_fetch from /i, '网页抓取 ');
        };

        const actionTitle = cleanTitle(task?.title);
        const statusLabel = isFinished ? '✅' : '⏳';

        // 药丸卡片数据序列化打包
        const serializedPayload = JSON.stringify({
          id: m.id,
          label: `${statusLabel} ${actionTitle}`,
          source: 'core',
          content: trimmedContent || '系统任务执行中，暂无日志输出...'
        });

        return {
          id: m.id,
          timestamp: m.timestamp,
          from: { isLocal: false, name: 'Assistant' } as any,
          message: `[TOOL_CARD]:${serializedPayload}`
        };
      }

      // B. 正常消息
      return {
        id: m.id,
        timestamp: m.timestamp,
        from: { isLocal: m.isUser, name: m.isUser ? 'User' : 'Assistant' } as any,
        message: m.text,
      };
    }).filter(Boolean) as import('@livekit/components-react').ReceivedMessage[];

    const allMessages = [...messages, ...customReceivedMessages].sort((a, b) => a.timestamp - b.timestamp);

    // 🌟 优化 3：启发式去重算法（防大模型 Answer/Source 重复打印）
    const getNormalizedText = (text: string): string => {
      if (!text) return '';
      let targetText = text;
      if (text.startsWith('[TOOL_CARD]:')) {
        try {
          const payload = JSON.parse(text.substring('[TOOL_CARD]:'.length));
          targetText = payload.content || '';
        } catch {
          // ignore
        }
      }
      return targetText
        .replace(/^#+\s+/gm, '')
        .replace(/^(Answer|answer|Source|source|引文|来源)[:\s-]*/i, '')
        .replace(/\s+/g, '')
        .toLowerCase();
    };

    const uniqueMessages: typeof allMessages = [];

    for (const msg of allMessages) {
      const norm = getNormalizedText(msg.message);
      if (!norm) {
        uniqueMessages.push(msg);
        continue;
      }

      let isDuplicate = false;

      for (let i = 0; i < uniqueMessages.length; i++) {
        const existingNorm = getNormalizedText(uniqueMessages[i].message);
        if (!existingNorm) continue;

        const isAssistant = msg.from?.name === 'Assistant' && uniqueMessages[i].from?.name === 'Assistant';

        if (isAssistant) {
          if (norm === existingNorm) {
            isDuplicate = true;
            const msgIsDelta = (msg as any).isDelta;
            const existingIsDelta = (uniqueMessages[i] as any).isDelta;
            if (!msgIsDelta && existingIsDelta) {
              uniqueMessages[i] = msg;
            }
            break;
          }

          if (norm.startsWith(existingNorm) || existingNorm.startsWith(norm)) {
            if (norm.length > existingNorm.length) {
              uniqueMessages[i] = msg;
            }
            isDuplicate = true;
            break;
          }
        }
      }

      if (!isDuplicate) {
        uniqueMessages.push(msg);
      }
    }

    return uniqueMessages;
  }, [messages, customMessages]);

  useEffect(() => {
    const lastMessage = displayMessages.at(-1);
    const lastMessageIsLocal = lastMessage?.from?.isLocal === true;
    if (scrollAreaRef.current && lastMessageIsLocal) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [displayMessages]);

  useEffect(() => {
    if (session.isConnected && room) {
      const payload = JSON.stringify({ type: 'voice_change', voice: currentVoice });
      room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
    }
  }, [session.isConnected, room, currentVoice]);

  const handleSendText = async (message: string) => {
    const userMsg: MuteTextMessage = {
      id: `mute-user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      text: message,
      isDelta: false,
      timestamp: Date.now(),
      isUser: true,
    };
    setCustomMessages(prev => [...prev, userMsg]);

    if (room) {
      const payload = JSON.stringify({ type: 'user_text', text: message });
      try {
        await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
      } catch (e) {
        console.error('[Mute Mode] publishData error:', e);
      }
    }
  };

  useEffect(() => {
    if (!room) return;

    // 串行化排队调度打字机 (Scheduler)
    const speed = 15;
    schedulerTimerRef.current = setInterval(() => {
      const queue = taskQueueRef.current;
      let index = currentTaskIndexRef.current;

      // 1. 任务初始化与调度切换
      if (index === -1) {
        index = queue.findIndex(t => !t.isFinished || t.displayedText.length < t.sourceText.length);
        currentTaskIndexRef.current = index;

        if (index !== -1) {
          const firstTask = queue[index];
          setCustomMessages(prev => {
            if (prev.find(m => m.id === firstTask.id)) return prev;
            return [...prev, {
              id: firstTask.id,
              text: '',
              isDelta: true,
              timestamp: Date.now(),
              isUser: false,
            }];
          });
        }
        return;
      }

      // 2. 打字机逐字显示驱动
      const task = queue[index];
      if (!task) return;

      if (task.displayedText.length < task.sourceText.length) {
        const backlog = task.sourceText.length - task.displayedText.length;
        const step = task.type === 'tool'
          ? (backlog > 30 ? 8 : backlog > 15 ? 4 : 1)
          : (backlog > 30 ? 2 : backlog > 15 ? 2 : 1);

        task.displayedText += task.sourceText.substring(task.displayedText.length, task.displayedText.length + step);

        setCustomMessages(prev => {
          const existing = prev.find(m => m.id === task.id);
          if (!existing) return prev;

          return [
            ...prev.filter(m => m.id !== task.id),
            { ...existing, text: task.displayedText }
          ];
        });
      } else if (task.isFinished) {
        setCustomMessages(prev => {
          const existing = prev.find(m => m.id === task.id);
          if (!existing) return prev;

          return [
            ...prev.filter(m => m.id !== task.id),
            { ...existing, text: task.displayedText, isDelta: false }
          ];
        });

        currentTaskIndexRef.current = -1;
      }
    }, speed);

    const handleDataReceived = (data: Uint8Array, participant: any, kind?: DataPacket_Kind) => {
      if (kind !== DataPacket_Kind.RELIABLE) return;
      try {
        const text = new TextDecoder().decode(data);
        const payload = JSON.parse(text);
        const msgType = payload.type;

        // 队列状态探针
        const getActiveChatTask = () => {
          const q = taskQueueRef.current;
          for (let i = q.length - 1; i >= 0; i--) {
            if (q[i].type === 'chat' && !q[i].isFinished) return q[i];
          }
          return null;
        };

        const getToolTask = (toolCallId: string) => {
          return taskQueueRef.current.find(t => t.id === `mute-tool-${toolCallId}`);
        };

        // ================== 🌟 1. 对话文本增量（FIFO 排队化） ==================
        if (msgType === 'text_delta') {
          setIsMuteSpeaking(true);
          let activeChat = getActiveChatTask();
          if (!activeChat) {
            activeChat = {
              id: `mute-ai-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              type: 'chat',
              sourceText: '',
              displayedText: '',
              isFinished: false,
            };
            taskQueueRef.current.push(activeChat);
          }
          activeChat.sourceText += payload.text;
          return;
        }

        if (msgType === 'text') {
          setIsMuteSpeaking(false);
          const activeChat = getActiveChatTask();
          if (activeChat) {
            // 🌟 核心修复 1：防累积全文覆盖。只有在未收到 stream 增量时才使用全局 final 文本做兜底
            if (!activeChat.sourceText && payload.text) {
              activeChat.sourceText = payload.text;
            }
            activeChat.isFinished = true;
          }
          return;
        }

        // ================== 🌟 2. 工具链生命周期（FIFO 切割化） ==================
        if (msgType === 'tool_call') {
          const { phase, toolCallId, title, status } = payload;

          if (phase === 'start') {
            // 🌟 核心时序修复 4：工具启动时，不再"立即"关闭前置聊天气泡。
            // 因为并发原因，工具启动信号往往比大模型前置对话的最后几个流式字符（如"状态。"）先到。
            // 此时保持前置对话畅通，让迟到的文本正常落袋。
            taskQueueRef.current.push({
              id: `mute-tool-${toolCallId}`,
              type: 'tool',
              title: title,
              status: 'running',
              sourceText: '',
              displayedText: '',
              isFinished: false,
              toolStartTime: Date.now(),
            });
          } else if (phase === 'end') {
            const toolTask = getToolTask(toolCallId);
            if (toolTask) {
              toolTask.status = status;
              toolTask.isFinished = true;
            }

            // 🌟 核心时序修复 4：只有在工具结束执行（网络彻底静默、开始转入下一轮思考）时，才安全地将前置对话"封口"
            const activeChat = getActiveChatTask();
            if (activeChat) {
              activeChat.isFinished = true;
            }
          }
          return;
        }

        // ================== 🌟 3. 流式终端日志 ==================
        if (msgType === 'tool_output') {
          const { toolCallId, output, phase } = payload;
          const toolTask = getToolTask(toolCallId);

          // 🌟 核心时序修复 4（兜底）：只要工具开始产生输出，也立刻将前置聊天气泡"封口"确保隔离
          const activeChat = getActiveChatTask();
          if (activeChat) {
            activeChat.isFinished = true;
          }

          if (toolTask) {
            // 🌟 核心修复 2：全量包与增量流去重判断。
            if (phase === 'end') {
              toolTask.sourceText = output;
            } else {
              if (toolTask.sourceText && output.startsWith(toolTask.sourceText)) {
                toolTask.sourceText = output;
              } else if (!toolTask.sourceText.endsWith(output)) {
                toolTask.sourceText += output;
              }
            }
          }
          return;
        }

        // ================== 4. 静音控制 ==================
        if (msgType === 'mute_toggle') {
          const actualMuteMode = payload.muted === true;
          setIsMuteMode(actualMuteMode);
          if (!actualMuteMode) {
            setIsMuteSpeaking(false);
            taskQueueRef.current = [];
            currentTaskIndexRef.current = -1;
          }
          return;
        }

      } catch (e) {
        console.error('[Mute Mode] parse error:', e);
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => {
      room.off('dataReceived', handleDataReceived);
      if (schedulerTimerRef.current) {
        clearInterval(schedulerTimerRef.current);
        schedulerTimerRef.current = null;
      }
      taskQueueRef.current = [];
      currentTaskIndexRef.current = -1;
    };
  }, [room]);

  const controls: AgentControlBarControls = {
    leave: true, microphone: true, chat: supportsChatInput, camera: supportsVideoInput, screenShare: supportsScreenShare,
  };

  return (
    <section ref={ref} className={cn('bg-background relative z-10 h-full w-full overflow-hidden', className)} {...props}>
      <Fade top className="absolute inset-x-4 top-0 z-10 h-40" />

      <div className="absolute top-0 bottom-[135px] flex w-full flex-col md:bottom-[170px]">
        <AnimatePresence>
          {chatOpen && (
            <motion.div {...CHAT_MOTION_PROPS} className="flex h-full w-full flex-col gap-4 space-y-3 transition-opacity duration-300 ease-out">
              <AgentChatTranscript
                agentState={agentState}
                messages={displayMessages}
                className="mx-auto w-full max-w-2xl [&_.is-user>div]:rounded-[22px] [&>div>div]:px-4 [&>div>div]:pt-40 md:[&>div>div]:px-6"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <TileLayout
        state={effectiveAgentState}
        chatOpen={chatOpen}
        audioVisualizerType={audioVisualizerType} audioVisualizerColor={audioVisualizerColor}
        audioVisualizerColorShift={audioVisualizerColorShift} audioVisualizerBarCount={audioVisualizerBarCount}
        audioVisualizerRadialBarCount={audioVisualizerRadialBarCount} audioVisualizerRadialRadius={audioVisualizerRadialRadius}
        audioVisualizerGridRowCount={audioVisualizerGridRowCount} audioVisualizerGridColumnCount={audioVisualizerGridColumnCount}
        audioVisualizerWaveLineWidth={audioVisualizerWaveLineWidth}
      />

      <motion.div {...BOTTOM_VIEW_MOTION_PROPS} className="absolute inset-x-3 bottom-0 z-50 md:inset-x-12">
        {isPreConnectBufferEnabled && (
          <AnimatePresence>
            {displayMessages.length === 0 && (
              <MotionMessage key="pre-connect-message" duration={2} aria-hidden={displayMessages.length > 0} {...SHIMMER_MOTION_PROPS} className="pointer-events-none mx-auto block w-full max-w-2xl pb-4 text-center text-sm font-semibold">
                {preConnectMessage}
              </MotionMessage>
            )}
          </AnimatePresence>
        )}
        <div className="bg-background relative mx-auto max-w-2xl pb-3 md:pb-12">
          <Fade bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />
          <AgentControlBar
            variant="livekit"
            controls={controls}
            isChatOpen={chatOpen}
            isConnected={session.isConnected}
            isMuteMode={isMuteMode}
            onSendText={handleSendText}
            onDisconnect={session.end}
            onIsChatOpenChange={setChatOpen}
          />
          <VoiceCharacterButton className="absolute right-0 -top-12" />
        </div>
      </motion.div>
    </section>
  );
}
