import { useMemo } from 'react';
import { Room } from 'livekit-client';
import {
  type ReceivedChatMessage,
  type TextStreamData,
  useChat,
  useRoomContext,
  useTranscriptions,
} from '@livekit/components-react';
import { type AppConfig } from '@/app-config';

function transcriptionToChatMessage(
  textStream: TextStreamData,
  room: Room,
  config?: Pick<
    AppConfig,
    'enableSmartParticipantMatching' | 'enableTranscriptionDebug' | 'userTranscriptionIdentities'
  >
): ReceivedChatMessage {
  // 尝试匹配参与者
  let matchedParticipant = null;

  // 检查是否是用户转录身份（如自定义音频track）
  const userIdentities = config?.userTranscriptionIdentities || [];
  if (userIdentities.includes(textStream.participantInfo.identity)) {
    matchedParticipant = room.localParticipant;
  } else if (textStream.participantInfo.identity === room.localParticipant.identity) {
    matchedParticipant = room.localParticipant;
  } else {
    // 查找远程参与者
    matchedParticipant = Array.from(room.remoteParticipants.values()).find(
      (p) => p.identity === textStream.participantInfo.identity
    );
  }

  // 如果没有找到匹配的参与者，尝试智能匹配（如果启用）
  if (!matchedParticipant && config?.enableSmartParticipantMatching) {
    const remoteParticipants = Array.from(room.remoteParticipants.values());
    if (remoteParticipants.length > 0) {
      // 优先匹配包含"agent"的参与者
      const agentParticipant = remoteParticipants.find(
        (p) =>
          p.identity.toLowerCase().includes('agent') ||
          p.identity.toLowerCase().includes('assistant') ||
          p.identity.toLowerCase().includes('bot')
      );
      matchedParticipant = agentParticipant || remoteParticipants[0];
    }
  }

  // 调试日志（如果启用）
  if (config?.enableTranscriptionDebug) {
    console.log('[Transcription]', {
      participant: textStream.participantInfo.identity,
      mappedTo: matchedParticipant?.identity || 'undefined',
      isLocal: matchedParticipant?.isLocal,
      text: textStream.text.substring(0, 50) + '...',
    });
  }

  return {
    id: textStream.streamInfo.id,
    timestamp: textStream.streamInfo.timestamp,
    message: textStream.text,
    from: matchedParticipant,
  };
}

export function useChatMessages(
  config?: Pick<
    AppConfig,
    'enableSmartParticipantMatching' | 'enableTranscriptionDebug' | 'userTranscriptionIdentities'
  >
) {
  const chat = useChat();
  const room = useRoomContext();
  const transcriptions: TextStreamData[] = useTranscriptions();

  const mergedTranscriptions = useMemo(() => {
    // 处理转录消息
    const transcriptionMessages = transcriptions.map((transcription) =>
      transcriptionToChatMessage(transcription, room, config)
    );

    // 处理聊天消息，确保agent消息有正确的参与者信息
    const processedChatMessages = chat.chatMessages.map((chatMessage) => {
      if (!chatMessage.from && config?.enableSmartParticipantMatching) {
        // 如果聊天消息没有from信息，尝试智能匹配
        const remoteParticipants = Array.from(room.remoteParticipants.values());
        if (remoteParticipants.length > 0) {
          const agentParticipant =
            remoteParticipants.find(
              (p) =>
                p.identity.toLowerCase().includes('agent') ||
                p.identity.toLowerCase().includes('assistant') ||
                p.identity.toLowerCase().includes('bot')
            ) || remoteParticipants[0];

          return {
            ...chatMessage,
            from: agentParticipant,
          };
        }
      }
      return chatMessage;
    });

    const merged: Array<ReceivedChatMessage> = [...transcriptionMessages, ...processedChatMessages];

    return merged.sort((a, b) => a.timestamp - b.timestamp);
  }, [transcriptions, chat.chatMessages, room, config]);

  return mergedTranscriptions;
}
