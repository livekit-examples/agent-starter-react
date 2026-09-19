'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Brain,
  Clock,
  History,
  Maximize2,
  MessageSquareTextIcon,
  Minimize2,
  Search,
  Send,
  Sparkles,
  XIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useRoomContext } from '@livekit/components-react';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/shadcn/utils';

interface Session {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
}

interface Model {
  id: string;
  name: string;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  isChatFullscreen?: boolean;
  onChatFullscreenChange?: (fullscreen: boolean) => void;
}

function groupSessions(sessions: Session[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; sessions: Session[] }[] = [];
  const todaySessions: Session[] = [];
  const yesterdaySessions: Session[] = [];
  const olderSessions: Session[] = [];

  for (const s of sessions) {
    const d = new Date(s.updatedAt);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) todaySessions.push(s);
    else if (d.getTime() === yesterday.getTime()) yesterdaySessions.push(s);
    else olderSessions.push(s);
  }

  if (todaySessions.length > 0) groups.push({ label: 'Сегодня', sessions: todaySessions });
  if (yesterdaySessions.length > 0) groups.push({ label: 'Вчера', sessions: yesterdaySessions });
  if (olderSessions.length > 0) groups.push({ label: 'Ранее', sessions: olderSessions });

  return groups;
}

const sampleTableData = [
  {
    task: 'Реализовать middleware аутентификации',
    status: '✅ Готово',
    priority: 'Высокий',
    assignee: 'Алиса',
  },
  {
    task: 'Написать документацию API',
    status: '🔄 В процессе',
    priority: 'Средний',
    assignee: 'Боб',
  },
  {
    task: 'Исправить баг редиректа входа',
    status: '✅ Готово',
    priority: 'Высокий',
    assignee: 'Алиса',
  },
  {
    task: 'Дизайн панели управления',
    status: '⏳ Ожидает',
    priority: 'Низкий',
    assignee: 'Каролина',
  },
  {
    task: 'Скрипт миграции базы данных',
    status: '🔄 В процессе',
    priority: 'Высокий',
    assignee: 'Боб',
  },
  { task: 'Сквозные тесты', status: '⏳ Ожидает', priority: 'Средний', assignee: 'Каролина' },
];

function SampleTable() {
  return (
    <div className="border-zinc-800 mb-4 overflow-hidden rounded-lg border bg-zinc-900/50">
      <div className="bg-zinc-800 text-zinc-400 px-3 py-2 text-[11px] font-semibold tracking-wider uppercase">
        Задачи проекта
      </div>
      <div className="overflow-x-auto">
        <Table className="w-full text-xs">
          <TableHeader>
            <TableRow className="border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800/30 border-b">
              <TableHead className="text-sidebar-foreground/70 px-3 py-2 font-semibold">
                Задача
              </TableHead>
              <TableHead className="text-sidebar-foreground/70 px-3 py-2 font-semibold">
                Статус
              </TableHead>
              <TableHead className="text-sidebar-foreground/70 px-3 py-2 font-semibold">
                Приоритет
              </TableHead>
              <TableHead className="text-sidebar-foreground/70 px-3 py-2 font-semibold">
                Исполнитель
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sampleTableData.map((row, i) => (
              <TableRow
                key={i}
                className={cn(
                  'border-sidebar-border/10 border-b',
                  i % 2 === 0 ? 'bg-sidebar-accent/10' : 'bg-transparent',
                  'hover:bg-sidebar-accent/20'
                )}
              >
                <TableCell className="text-sidebar-foreground max-w-[140px] truncate px-3 py-2 font-medium">
                  {row.task}
                </TableCell>
                <TableCell className="text-sidebar-foreground/80 px-3 py-2 whitespace-nowrap">
                  {row.status}
                </TableCell>
                <TableCell className="px-3 py-2 whitespace-nowrap">
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      row.priority === 'Высокий' && 'bg-destructive/15 text-destructive',
                      row.priority === 'Средний' &&
                        'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                      row.priority === 'Низкий' &&
                        'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {row.priority}
                  </span>
                </TableCell>
                <TableCell className="text-sidebar-foreground/60 px-3 py-2">
                  {row.assignee}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function Sidebar({
  open,
  onClose,
  isChatFullscreen = false,
  onChatFullscreenChange,
}: SidebarProps) {
  const room = useRoomContext();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showSampleTable, setShowSampleTable] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'send_data'>('chat');

  const [textData, setTextData] = useState('');
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    if (room?.name) {
      setRoomName(room.name);
    }
  }, [room]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSessions(data.sessions ?? []);
      })
      .catch((error) => console.error('Error fetching sessions:', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .then((data) => {
        const list: Model[] = Array.isArray(data.models) ? data.models : [];
        if (cancelled) return;
        setModels(list);
        if (list.length > 0) setSelectedModel(list[0].id);
      })
      .catch((error) => console.error('Error fetching models:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSendData = async () => {
    if (!textData) return;
    const participant = room?.localParticipant;
    if (!participant) return;
    try {
      const payload = JSON.stringify({
        message: textData,
        room_name: roomName,
      });
      await participant.publishData(new TextEncoder().encode(payload), {
        topic: 'prtluserdata',
        reliable: true,
      });
      toast.success('Данные отправлены!');
      setTextData('');
    } catch (error) {
      console.error('Error sending data over LiveKit:', error);
      toast.error('Не удалось отправить данные.');
    }
  };

  const filteredSessions = useMemo(() => {
    if (!search) return sessions;
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.preview.toLowerCase().includes(search.toLowerCase())
    );
  }, [sessions, search]);

  const grouped = useMemo(() => groupSessions(filteredSessions), [filteredSessions]);

  return (
    <Drawer open={open} onClose={onClose} side="left" className="w-1/2 min-w-80">
      <SidebarHeader className="border-zinc-800 border-b px-4 py-3 bg-black">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-zinc-800 flex size-8 items-center justify-center rounded-lg">
              <Brain className="size-5 text-white" />
            </div>
            <span className="text-sm font-semibold">AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChatFullscreenChange?.(!isChatFullscreen)}
              aria-pressed={isChatFullscreen}
              title={
                isChatFullscreen ? 'Выключить полноэкранный чат' : 'Развернуть чат на весь экран'
              }
              className={cn(
                'rounded-md p-1.5',
                isChatFullscreen && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              {isChatFullscreen ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-md p-1.5">
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>
      </SidebarHeader>

      <div className="border-zinc-800 flex items-center gap-1 border-b p-2 bg-black">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveTab('chat')}
          className={cn(
            'flex-1 gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md',
            activeTab === 'chat'
              ? 'bg-white text-black'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          )}
        >
          <MessageSquareTextIcon className="size-3.5" />
          Диалоги
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveTab('send_data')}
          className={cn(
            'flex-1 gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md',
            activeTab === 'send_data'
              ? 'bg-white text-black'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          )}
        >
          <Send className="size-3.5" />
          Отправить
        </Button>
      </div>

      {activeTab === 'send_data' ? (
        <SidebarContent className="p-4 bg-zinc-900/30">
          <SidebarGroup>
            <SidebarGroupContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sidebar-room-name" className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Название комнаты</Label>
                <Input
                  id="sidebar-room-name"
                  placeholder="Введите название комнаты..."
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="border-zinc-800 bg-zinc-500/10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sidebar-text-data" className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Данные</Label>
                <div className="flex flex-col gap-2">
                  <textarea
                    id="sidebar-text-data"
                    className="border-zinc-800 bg-zinc-500/10 placeholder:text-zinc-500 focus-visible:border-zinc-600 focus-visible:ring-1 focus-visible:ring-zinc-600 flex min-h-[120px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Введите текст для отправки..."
                    value={textData}
                    onChange={(e) => setTextData(e.target.value)}
                  />
                  <Button onClick={handleSendData} className="w-full bg-white text-black hover:bg-white/90" disabled={!textData}>
                    Отправить данные
                  </Button>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      ) : (
        <>
          <div className="border-sidebar-border/50 border-b px-4 py-3">
            <SidebarGroup>
              <SidebarGroupContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <Label className="text-sidebar-foreground/60 text-[11px] font-semibold tracking-wider uppercase">
                      Модель
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-sidebar-foreground/60 h-6 px-2 text-[10px]"
                      onClick={() => setShowSampleTable(!showSampleTable)}
                    >
                      {showSampleTable ? 'Скрыть' : 'Добавить таблицу'}
                    </Button>
                  </div>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="border-sidebar-border/30 bg-sidebar-accent/20 h-8 text-xs">
                      <SelectValue placeholder="Выберите модель..." />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center gap-2">
                            <Sparkles className="text-sidebar-foreground/40 size-3" />
                            {model.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>

          <div className="border-zinc-800 border-b px-4 py-2.5 bg-black">
            <div className="relative">
              <Search className="text-zinc-500 pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск диалогов..."
                className="border-zinc-800 bg-zinc-900/50 placeholder:text-zinc-500 py-1.5 pr-2.5 pl-8 text-xs"
              />
            </div>
          </div>

          <SidebarContent className="p-3">
            {showSampleTable && <SampleTable />}
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20">
                <div className="border-zinc-800 border-t-white/70 size-6 animate-spin rounded-full border-2" />
                <span className="text-zinc-500 animate-pulse text-[11px]">
                  Загрузка диалогов...
                </span>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20">
                <div className="bg-zinc-800/50 flex size-12 items-center justify-center rounded-full">
                  <History className="text-zinc-500 size-5" />
                </div>
                <p className="text-zinc-500 px-4 text-center text-xs leading-relaxed">
                  {search ? 'Нет диалогов по вашему запросу.' : 'Пока нет диалогов.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {grouped.map((group) => (
                  <SidebarGroup key={group.label}>
                    <SidebarGroupLabel className="text-sidebar-foreground/40 text-[11px] tracking-wider uppercase">
                      {group.label}
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.sessions.map((session) => (
                          <SidebarMenuItem key={session.id}>
                            <motion.button
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2 }}
                              whileTap={{ scale: 0.98 }}
                              className={cn(
                                'group w-full rounded-lg p-3 text-left transition-all duration-200',
                                'hover:bg-zinc-800 hover:text-white',
                                'hover:border-zinc-700/50 border border-transparent'
                              )}
                            >
                              <div className="mb-1 flex items-center gap-2">
                                <span className="flex-1 truncate text-sm font-medium">
                                  {session.title}
                                </span>
                                <span className="text-sidebar-foreground/25 shrink-0 text-[10px] opacity-0 transition-opacity group-hover:opacity-100">
                                  <Clock className="size-3" />
                                </span>
                              </div>
                              <div className="text-sidebar-foreground/45 mb-1.5 line-clamp-2 text-xs leading-relaxed">
                                {session.preview}
                              </div>
                              <div className="text-sidebar-foreground/25 flex items-center gap-1.5 text-[10px]">
                                <Clock className="size-2.5" />
                                {new Date(session.updatedAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year:
                                    new Date(session.updatedAt).getFullYear() ===
                                    new Date().getFullYear()
                                      ? undefined
                                      : 'numeric',
                                })}
                              </div>
                            </motion.button>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                ))}
              </div>
            )}
          </SidebarContent>
        </>
      )}

      <div className="border-zinc-800 flex flex-col gap-2 border-t p-3 bg-black">
        <ThemeToggle />
      </div>
    </Drawer>
  );
}
