'use client';

import { useState } from 'react';
import { cn } from '@/lib/shadcn/utils';
import { Streamdown } from 'streamdown';

// 工具卡片数据接口
export interface ToolCardData {
  id: string;
  label: string;
  source?: 'plugin' | 'core' | 'channel';
  pluginId?: string;
  channelId?: string;
  content: string; // markdown 格式的工具输出
}

interface ToolCardProps {
  tool: ToolCardData;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Strip markdown headers (## ### etc) for cleaner display within cards.
 */
function stripHeaders(text: string): string {
  return text.replace(/^#{1,6}\s+/gm, '');
}

/**
 * A pill-shaped expandable tool card, matching OpenClaw's agent-tools-runtime-chip style.
 * Click the pill to expand and view formatted tool output content.
 */
export function ToolCard({ tool, defaultOpen = false, className }: ToolCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  const sourceLabel =
    tool.source === 'plugin' && tool.pluginId
      ? `Plugin: ${tool.pluginId}`
      : tool.source === 'channel' && tool.channelId
        ? `Channel: ${tool.channelId}`
        : tool.source === 'core'
          ? 'Built-In'
          : null;

  return (
    <div className={cn('group relative max-w-full min-w-0', className)}>
      {/* 药丸按钮 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all',
          'max-w-full min-w-0 border-neutral-200 bg-neutral-50/10 text-foreground',
          'hover:border-neutral-400 hover:bg-neutral-100/15 dark:border-neutral-700 dark:bg-neutral-800/20 dark:hover:border-neutral-500 dark:hover:bg-neutral-700/30',
          'cursor-pointer'
        )}
      >
        <span className="min-w-0 shrink-0 truncate font-mono text-xs">{tool.label}</span>
        {sourceLabel && (
          <span className="text-muted-foreground min-w-0 shrink-0 truncate text-xs">{sourceLabel}</span>
        )}
        {/* 展开/收起箭头 */}
        <span
          className={cn(
            'text-muted-foreground shrink-0 text-xs transition-transform duration-150',
            open && 'rotate-90'
          )}
        >
          ▸
        </span>
      </button>

      {/* 展开内容区 */}
      {open && (
        <div
          className={cn(
            'mt-2 w-full max-w-full overflow-hidden rounded-xl border border-neutral-200 bg-background p-4',
            'dark:border-neutral-700 dark:bg-neutral-900/50'
          )}
        >
          <div className="text-sm leading-relaxed overflow-x-auto break-words">
            <Streamdown className="max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              {stripHeaders(tool.content)}
            </Streamdown>
          </div>
        </div>
      )}
    </div>
  );
}