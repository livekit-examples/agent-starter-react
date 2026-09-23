'use client';

import { type ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import {
  CommandIcon,
  FileIcon,
  Loader,
  MessageSquareTextIcon,
  PaperclipIcon,
  SendHorizontal,
  XIcon,
} from 'lucide-react';
import { type MotionProps, motion } from 'motion/react';
import { useChat, useSessionContext } from '@livekit/components-react';
import { AgentDisconnectButton } from '@/components/agents-ui/agent-disconnect-button';
import { AgentTrackControl } from '@/components/agents-ui/agent-track-control';
import {
  AgentTrackToggle,
  agentTrackToggleVariants,
} from '@/components/agents-ui/agent-track-toggle';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import {
  type UseInputControlsProps,
  useInputControls,
  usePublishPermissions,
} from '@/hooks/agents-ui/use-agent-control-bar';
import { sendFile } from '@/lib/send-file';
import { cn } from '@/lib/shadcn/utils';

const LK_TOGGLE_VARIANT_1 = [
  'data-[state=off]:bg-accent data-[state=off]:hover:bg-foreground/10',
  'data-[state=off]:[&_~_button]:bg-accent data-[state=off]:[&_~_button]:hover:bg-foreground/10',
  'data-[state=off]:border-border data-[state=off]:hover:border-foreground/12',
  'data-[state=off]:[&_~_button]:border-border data-[state=off]:[&_~_button]:hover:border-foreground/12',
  'data-[state=off]:text-destructive data-[state=off]:hover:text-destructive data-[state=off]:focus:text-destructive',
  'data-[state=off]:focus-visible:ring-foreground/12 data-[state=off]:focus-visible:border-ring',
  'dark:data-[state=off]:[&_~_button]:bg-accent dark:data-[state=off]:[&_~_button]:hover:bg-foreground/10',
];

export interface Command {
  command: string;
  description: string;
  example: string;
}

const DEFAULT_COMMANDS: Command[] = [
  { command: '/help', description: 'Показать доступные команды', example: '/help' },
  { command: '/clear', description: 'Очистить историю чата', example: '/clear' },
  {
    command: '/feedback',
    description: 'Отправить отзыв об агенте',
    example: '/feedback Агент был полезен',
  },
  { command: '/summarize', description: 'Суммировать разговор', example: '/summarize' },
  { command: '/voice', description: 'Переключиться в голосовой режим', example: '/voice' },
  {
    command: '/realtime',
    description: 'Переключиться в режим реального времени',
    example: '/realtime',
  },
  { command: '/call', description: 'Начать звонок', example: '/call' },
  { command: '/imgstream', description: 'Запустить поток изображений', example: '/imgstream' },
];

const LK_TOGGLE_VARIANT_2 = [
  'data-[state=off]:bg-accent data-[state=off]:hover:bg-foreground/10',
  'data-[state=off]:border-border data-[state=off]:hover:border-foreground/12',
  'data-[state=off]:focus-visible:border-ring data-[state=off]:focus-visible:ring-foreground/12',
  'data-[state=off]:text-foreground data-[state=off]:hover:text-foreground data-[state=off]:focus:text-foreground',
  'data-[state=on]:bg-blue-500/20 data-[state=on]:hover:bg-blue-500/30',
  'data-[state=on]:border-blue-700/10 data-[state=on]:text-blue-700 data-[state=on]:ring-blue-700/30',
  'data-[state=on]:focus-visible:border-blue-700/50',
  'dark:data-[state=on]:bg-blue-500/20 dark:data-[state=on]:text-blue-300',
];

const MOTION_PROPS: MotionProps = {
  variants: {
    hidden: {
      height: 0,
      opacity: 0,
      marginBottom: 0,
    },
    visible: {
      height: 'auto',
      opacity: 1,
      marginBottom: 12,
    },
  },
  initial: 'hidden',
  transition: {
    duration: 0.3,
    ease: 'easeOut',
  },
};

function useCommands(): Command[] {
  const [commands, setCommands] = useState<Command[]>(DEFAULT_COMMANDS);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/commands', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.commands) && data.commands.length > 0) {
          setCommands(data.commands);
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  return commands;
}

function getCommandFromText(text: string): string | null {
  const matches = [...text.matchAll(/(?:^|\s)(\/[a-zA-Z]*)/g)];
  if (matches.length === 0) return null;
  return matches[matches.length - 1][1];
}

function getCommandText(text: string): string {
  const match = text.match(/(?:^|\s)(\/[a-zA-Z]*)/);
  return match ? match[0].trimStart() : '';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

interface AgentChatInputProps {
  chatOpen: boolean;
  onSend?: (message: string, files?: File[]) => void;
  onClear?: () => void;
  className?: string;
  commands?: Command[];
}

function AgentChatInput({
  chatOpen,
  onSend = async () => {},
  onClear,
  className,
  commands: externalCommands,
}: AgentChatInputProps) {
  const defaultCommands = useCommands();
  const commands = externalCommands ?? defaultCommands;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCommands, setShowCommands] = useState(false);
  const [attachments, setAttachments] = useState<{ file: File; preview: string }[]>([]);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const isDisabled = isSending || (message.trim().length === 0 && attachments.length === 0);

  const activeCommandPrefix = useMemo(() => getCommandFromText(message), [message]);
  const filteredCommands = useMemo(() => {
    if (!activeCommandPrefix) return [];
    const query = activeCommandPrefix.toLowerCase();
    return commands.filter((c) => c.command.startsWith(query));
  }, [activeCommandPrefix, commands]);

  const isCommandActive = showCommands && filteredCommands.length > 0;

  useEffect(() => {
    setShowCommands(activeCommandPrefix !== null);
    setSelectedIndex(0);
  }, [activeCommandPrefix]);

  const handleSelectCommand = (cmd: Command) => {
    const text = getCommandText(message);
    const before = message.slice(0, message.lastIndexOf(text));
    const after = message.slice(message.lastIndexOf(text) + text.length);
    setMessage(before + cmd.command + ' ' + after);
    setShowCommands(false);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (isDisabled) {
      return;
    }

    const trimmed = message.trim();

    if (trimmed === '/clear') {
      onClear?.();
      setMessage('');
      clearAttachments();
      return;
    }

    try {
      setIsSending(true);
      const files = attachments.length > 0 ? attachments.map((a) => a.file) : undefined;
      await onSend(trimmed, files);
      setMessage('');
      clearAttachments();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const newAttachments = selected.map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const clearAttachments = () => {
    setAttachments((prev) => {
      for (const attachment of prev) {
        if (attachment.preview) URL.revokeObjectURL(attachment.preview);
      }
      return [];
    });
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isCommandActive) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectCommand(filteredCommands[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommands(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleButtonClick = async () => {
    if (isDisabled) return;
    await handleSend();
  };

  useEffect(() => {
    if (chatOpen) return;
    inputRef.current?.focus();
  }, [chatOpen]);

  useEffect(() => {
    return () => {
      // Revoke preview URLs that are still mounted when the input unmounts.
      for (const attachment of attachmentsRef.current) {
        if (attachment.preview) URL.revokeObjectURL(attachment.preview);
      }
    };
  }, []);

  return (
    <div
      className={cn('relative mb-3 flex grow flex-col gap-2 rounded-md pl-1 text-sm', className)}
    >
      {/* Pending attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {attachments.map((attachment, index) => (
            <span
              key={attachment.preview || `${attachment.file.name}-${index}`}
              className="bg-accent text-accent-foreground border-input inline-flex max-w-56 items-center gap-1.5 rounded-md border py-1 pr-1 pl-1 text-xs"
            >
              {attachment.preview ? (
                <img
                  src={attachment.preview}
                  alt=""
                  className="border-input size-5 shrink-0 rounded-sm border object-cover"
                />
              ) : (
                <FileIcon className="text-muted-foreground size-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate" title={attachment.file.name}>
                {attachment.file.name}
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {formatFileSize(attachment.file.size)}
              </span>
              <button
                type="button"
                title="Удалить"
                aria-label={`Удалить ${attachment.file.name}`}
                onClick={() => handleRemoveAttachment(index)}
                className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 focus-visible:ring-ring inline-flex size-4 cursor-pointer items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex grow items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          size="icon"
          type="button"
          variant="ghost"
          disabled={!chatOpen || isSending}
          title="Прикрепить файл"
          aria-label="Прикрепить файл"
          onClick={() => fileInputRef.current?.click()}
          className="self-end disabled:cursor-not-allowed"
        >
          <PaperclipIcon />
        </Button>
        <textarea
          autoFocus
          ref={inputRef}
          value={message}
          disabled={!chatOpen || isSending}
          placeholder="Ваше сообщение..."
          onKeyDown={handleKeyDown}
          onChange={(e) => setMessage(e.target.value)}
          className="field-sizing-content max-h-16 min-h-8 flex-1 resize-none [scrollbar-width:thin] py-2 text-base focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          size="icon"
          type="button"
          disabled={isDisabled}
          variant={isDisabled ? 'secondary' : 'default'}
          title={isSending ? 'отправка...' : 'отправить'}
          onClick={handleButtonClick}
          className="self-end disabled:cursor-not-allowed"
        >
          {isSending ? <Loader className="animate-spin" /> : <SendHorizontal />}
        </Button>
      </div>

      {/* Slash command suggestion popover */}
      {isCommandActive && (
        <div
          ref={listRef}
          className="bg-popover absolute right-0 bottom-full left-0 z-50 mb-1 max-h-48 overflow-y-auto rounded-md border p-1 shadow-md"
        >
          {filteredCommands.map((cmd, i) => (
            <button
              key={cmd.command}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectCommand(cmd);
              }}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none',
                i === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'text-popover-foreground hover:bg-accent/50'
              )}
            >
              <CommandIcon className="size-3.5 shrink-0 opacity-60" />
              <span className="font-medium">{cmd.command}</span>
              <span className="text-muted-foreground ml-auto text-xs">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Configuration for which controls to display in the AgentControlBar. */
export interface AgentControlBarControls {
  /**
   * Whether to show the leave/disconnect button.
   *
   * @defaultValue true
   */
  leave?: boolean;
  /**
   * Whether to show the camera toggle control.
   *
   * @defaultValue true (if camera publish permission is granted)
   */
  camera?: boolean;
  /**
   * Whether to show the microphone toggle control.
   *
   * @defaultValue true (if microphone publish permission is granted)
   */
  microphone?: boolean;
  /**
   * Whether to show the screen share toggle control.
   *
   * @defaultValue true (if screen share publish permission is granted)
   */
  screenShare?: boolean;
  /**
   * Whether to show the chat toggle control.
   *
   * @defaultValue true (if data publish permission is granted)
   */
  chat?: boolean;
}

export interface AgentControlBarProps extends UseInputControlsProps {
  /**
   * The visual style of the control bar.
   *
   * @default 'default'
   */
  variant?: 'default' | 'outline' | 'livekit';
  /**
   * This takes an object with the following keys: `leave`, `microphone`, `screenShare`, `camera`,
   * `chat`. Each key maps to a boolean value that determines whether the control is displayed.
   *
   * @default
   * {
   *   leave: true,
   *   microphone: true,
   *   screenShare: true,
   *   camera: true,
   *   chat: true,
   * }
   */
  controls?: AgentControlBarControls;
  /**
   * Whether to save user choices.
   *
   * @default true
   */
  saveUserChoices?: boolean;
  /**
   * Whether the agent is connected to a session.
   *
   * @default false
   */
  isConnected?: boolean;
  /**
   * Whether the chat input interface is open.
   *
   * @default false
   */
  isChatOpen?: boolean;
  /** The callback for when the user disconnects. */
  onDisconnect?: () => void;
  /** The callback for when the chat is opened or closed. */
  onIsChatOpenChange?: (open: boolean) => void;
  /** The callback for when a device error occurs. */
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
  /** The callback for when the chat transcript should be cleared. */
  onClear?: () => void;
  /**
   * Optional commands to override the default command list.
   * If not provided, commands are fetched from the API.
   */
  commands?: Command[];
}

/**
 * A control bar specifically designed for voice assistant interfaces. Provides controls for
 * microphone, camera, screen share, chat, and disconnect. Includes an expandable chat input for
 * text-based interaction with the agent.
 *
 * @example
 *
 * ```tsx
 * <AgentControlBar
 *   variant="livekit"
 *   isConnected={true}
 *   onDisconnect={() => handleDisconnect()}
 *   controls={{
 *     microphone: true,
 *     camera: true,
 *     screenShare: false,
 *     chat: true,
 *     leave: true,
 *   }}
 * />;
 * ```
 *
 * @extends ComponentProps<'div'>
 */
export function AgentControlBar({
  variant = 'default',
  controls,
  isChatOpen = false,
  isConnected = false,
  saveUserChoices = true,
  onDisconnect,
  onDeviceError,
  onIsChatOpenChange,
  onClear,
  className,
  commands,
  ...props
}: AgentControlBarProps & ComponentProps<'div'>) {
  const { send } = useChat();
  const publishPermissions = usePublishPermissions();
  const [isChatOpenUncontrolled, setIsChatOpenUncontrolled] = useState(isChatOpen);
  const {
    microphoneTrack,
    cameraToggle,
    microphoneToggle,
    screenShareToggle,
    handleAudioDeviceChange,
    handleVideoDeviceChange,
    handleMicrophoneDeviceSelectError,
    handleCameraDeviceSelectError,
  } = useInputControls({ onDeviceError, saveUserChoices });

  const session = useSessionContext();

  const handleSendMessage = async (message: string, files?: File[]) => {
    let text = message;

    if (files && files.length > 0 && session.room.localParticipant) {
      const fileNames: string[] = [];
      for (const file of files) {
        const info = await sendFile(session.room.localParticipant, file);
        fileNames.push(info.name);
      }
      const fileRefs = fileNames.map((n) => `[${n}]`).join(' ');
      text = text ? `${text} ${fileRefs}` : fileRefs;
    }

    await send(text);
  };

  const visibleControls = {
    leave: controls?.leave ?? true,
    microphone: controls?.microphone ?? publishPermissions.microphone,
    screenShare: controls?.screenShare ?? publishPermissions.screenShare,
    camera: controls?.camera ?? publishPermissions.camera,
    chat: controls?.chat ?? publishPermissions.data,
  };

  const isEmpty = Object.values(visibleControls).every((value) => !value);

  if (isEmpty) {
    console.warn('AgentControlBar: `visibleControls` contains only false values.');
    return null;
  }

  return (
    <div
      aria-label="Управление голосовым ассистентом"
      className={cn(
        'bg-background border-input/50 dark:border-muted flex flex-col border p-3 drop-shadow-md/3',
        'flex flex-col border border-zinc-200 bg-white p-3 text-black shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-white',
        variant === 'livekit' ? 'rounded-[31px]' : 'rounded-lg',
        className
      )}
      {...props}
    >
      <motion.div
        {...MOTION_PROPS}
        inert={!(isChatOpen || isChatOpenUncontrolled)}
        animate={isChatOpen || isChatOpenUncontrolled ? 'visible' : 'hidden'}
        className="border-input/50 flex w-full items-start border-b"
      >
        <AgentChatInput
          chatOpen={isChatOpen || isChatOpenUncontrolled}
          onSend={handleSendMessage}
          onClear={onClear}
          commands={commands}
          className={cn(variant === 'livekit' && '[&_button]:rounded-full')}
        />
      </motion.div>

      <div className="flex gap-1">
        <div className="flex grow gap-1">
          {/* Toggle Microphone */}
          {visibleControls.microphone && (
            <AgentTrackControl
              variant={variant === 'outline' ? 'outline' : 'default'}
              kind="audioinput"
              aria-label="Микрофон"
              source={Track.Source.Microphone}
              pressed={microphoneToggle.enabled}
              disabled={microphoneToggle.pending}
              audioTrack={microphoneTrack}
              onPressedChange={microphoneToggle.toggle}
              onActiveDeviceChange={handleAudioDeviceChange}
              onMediaDeviceError={handleMicrophoneDeviceSelectError}
              className={cn(
                variant === 'livekit' && [
                  LK_TOGGLE_VARIANT_1,
                  'rounded-full [&_button:first-child]:rounded-l-full [&_button:last-child]:rounded-r-full',
                ]
              )}
            />
          )}

          {/* Toggle Camera */}
          {visibleControls.camera && (
            <AgentTrackControl
              variant={variant === 'outline' ? 'outline' : 'default'}
              kind="videoinput"
              aria-label="Камера"
              source={Track.Source.Camera}
              pressed={cameraToggle.enabled}
              pending={cameraToggle.pending}
              disabled={cameraToggle.pending}
              onPressedChange={cameraToggle.toggle}
              onMediaDeviceError={handleCameraDeviceSelectError}
              onActiveDeviceChange={handleVideoDeviceChange}
              className={cn(
                variant === 'livekit' && [
                  LK_TOGGLE_VARIANT_1,
                  'rounded-full [&_button:first-child]:rounded-l-full [&_button:last-child]:rounded-r-full',
                ]
              )}
            />
          )}

          {/* Toggle Screen Share */}
          {visibleControls.screenShare && (
            <AgentTrackToggle
              variant={variant === 'outline' ? 'outline' : 'default'}
              aria-label="Демонстрация экрана"
              source={Track.Source.ScreenShare}
              pressed={screenShareToggle.enabled}
              disabled={screenShareToggle.pending}
              onPressedChange={screenShareToggle.toggle}
              className={cn(variant === 'livekit' && [LK_TOGGLE_VARIANT_2, 'rounded-full'])}
            />
          )}

          {/* Toggle Transcript */}
          {visibleControls.chat && (
            <Toggle
              variant={variant === 'outline' ? 'outline' : 'default'}
              pressed={isChatOpen || isChatOpenUncontrolled}
              aria-label="Чат"
              onPressedChange={(state) => {
                if (!onIsChatOpenChange) setIsChatOpenUncontrolled(state);
                else onIsChatOpenChange(state);
              }}
              className={agentTrackToggleVariants({
                variant: variant === 'outline' ? 'outline' : 'default',
                className: cn(variant === 'livekit' && [LK_TOGGLE_VARIANT_2, 'rounded-full']),
              })}
            >
              <MessageSquareTextIcon />
            </Toggle>
          )}
        </div>

        {/* Disconnect */}
        {visibleControls.leave && (
          <AgentDisconnectButton
            onClick={onDisconnect}
            disabled={!isConnected}
            className={cn(
              variant === 'livekit' &&
                'bg-destructive/10 dark:bg-destructive/10 text-destructive hover:bg-destructive/20 dark:hover:bg-destructive/20 focus:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/4 rounded-full font-mono text-xs font-bold tracking-wider'
            )}
          >
            <span className="hidden md:inline">Выйти</span>
            <span className="inline md:hidden">Выйти</span>
          </AgentDisconnectButton>
        )}
      </div>
    </div>
  );
}
