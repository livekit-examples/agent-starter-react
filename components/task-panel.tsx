'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  AirplaneTakeoffIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  type IconWeight,
  MapTrifoldIcon,
  ProhibitIcon,
  WarningCircleIcon,
  WrenchIcon,
} from '@phosphor-icons/react';
import {
  type ReplyState,
  type Task,
  type TimelineEntry,
  useTaskTracker,
} from '@/hooks/useTaskTracker';
import { cn } from '@/lib/shadcn/utils';

// --- presentational helpers ---

const TOOL_ICONS: Record<
  string,
  React.ComponentType<{ className?: string; weight?: IconWeight }>
> = {
  book_flight: AirplaneTakeoffIcon,
  tour_guide: MapTrifoldIcon,
};

function humanize(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_STYLES: Record<Task['status'], string> = {
  running: 'bg-primary/10 text-primary',
  done: 'bg-green-500/10 text-green-600 dark:text-green-400',
  error: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

function StatusPill({ status }: { status: Task['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        STATUS_STYLES[status]
      )}
    >
      {status === 'running' && <CircleNotchIcon className="size-3 animate-spin" weight="bold" />}
      {status === 'done' && <CheckCircleIcon className="size-3" weight="fill" />}
      {status === 'error' && <WarningCircleIcon className="size-3" weight="fill" />}
      {status === 'cancelled' && <ProhibitIcon className="size-3" weight="bold" />}
      {status}
    </span>
  );
}

// How each entry's reply is doing on its way to being spoken.
const REPLY_META: Record<ReplyState, { label: string; className: string; pulse?: boolean }> = {
  inline: { label: 'said inline', className: 'text-muted-foreground' },
  pending: { label: 'queued to say', className: 'text-amber-600 dark:text-amber-400' },
  scheduled: {
    label: 'speaking…',
    className: 'text-primary',
    pulse: true,
  },
  completed: { label: 'spoken', className: 'text-green-600 dark:text-green-400' },
  interrupted: { label: 'interrupted', className: 'text-destructive' },
  skipped: { label: 'already covered', className: 'text-muted-foreground' },
};

function ReplyBadge({ reply }: { reply: ReplyState }) {
  const meta = REPLY_META[reply];
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', meta.className)}>
      <span
        className={cn(
          'inline-block size-1.5 rounded-full bg-current',
          meta.pulse && 'animate-pulse'
        )}
      />
      {meta.label}
    </span>
  );
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative pl-4"
    >
      <span className="bg-border ring-background absolute top-1.5 left-0 size-1.5 -translate-x-1/2 rounded-full ring-2" />
      <p
        className={cn(
          'text-sm leading-snug',
          entry.kind === 'result' ? 'text-foreground font-medium' : 'text-foreground/90'
        )}
      >
        {entry.text}
      </p>
      <ReplyBadge reply={entry.reply} />
    </motion.li>
  );
}

function ArgChips({ args }: { args: Record<string, unknown> }) {
  const entries = Object.entries(args);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px]"
        >
          <span className="opacity-60">{key}:</span> {String(value)}
        </span>
      ))}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const Icon = TOOL_ICONS[task.name] ?? WrenchIcon;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className="bg-card rounded-xl border p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary grid size-8 place-content-center rounded-lg">
            <Icon className="size-4.5" weight="duotone" />
          </span>
          <h3 className="text-sm font-semibold">{humanize(task.name)}</h3>
        </div>
        <StatusPill status={task.status} />
      </div>

      <div className="mt-3 space-y-3">
        <ArgChips args={task.args} />

        {task.timeline.length > 0 && (
          <ol className="border-border space-y-2.5 border-l pl-0">
            <AnimatePresence initial={false}>
              {task.timeline.map((entry) => (
                <TimelineRow key={entry.id} entry={entry} />
              ))}
            </AnimatePresence>
          </ol>
        )}

        {task.status === 'error' && task.error && (
          <p className="bg-destructive/10 text-destructive rounded-md px-2 py-1 text-xs">
            {task.error}
          </p>
        )}
      </div>
    </motion.li>
  );
}

/**
 * A live panel of the agent's running and completed async tool calls. Renders nothing
 * until the first task arrives. Each card shows the call args, a timeline of progress
 * updates and the result, and — per entry — where its spoken reply is in its lifecycle.
 */
export function TaskPanel() {
  const tasks = useTaskTracker();
  // newest first
  const ordered = [...tasks].sort((a, b) => b.started_at - a.started_at);

  return (
    <AnimatePresence>
      {ordered.length > 0 && (
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          className="border-border bg-background/80 fixed top-0 right-0 z-30 flex h-svh w-[min(380px,90vw)] flex-col gap-3 border-l p-4 backdrop-blur-md"
        >
          <header className="flex items-center gap-2 px-1">
            <WrenchIcon className="text-muted-foreground size-4" weight="bold" />
            <h2 className="text-sm font-semibold tracking-tight">Tasks</h2>
            <span className="bg-muted text-muted-foreground ml-auto rounded-full px-2 py-0.5 text-xs">
              {ordered.length}
            </span>
          </header>
          <ol className="flex-1 space-y-3 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {ordered.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </AnimatePresence>
          </ol>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
