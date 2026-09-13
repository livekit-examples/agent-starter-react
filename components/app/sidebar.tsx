'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useRoomContext } from '@livekit/components-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/shadcn/utils';
import {
  SidebarProvider,
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

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
  { task: 'Реализовать middleware аутентификации', status: '✅ Готово', priority: 'Высокий', assignee: 'Алиса' },
  { task: 'Написать документацию API', status: '🔄 В процессе', priority: 'Средний', assignee: 'Боб' },
  { task: 'Исправить баг редиректа входа', status: '✅ Готово', priority: 'Высокий', assignee: 'Алиса' },
  { task: 'Дизайн панели управления', status: '⏳ Ожидает', priority: 'Низкий', assignee: 'Каролина' },
  { task: 'Скрипт миграции базы данных', status: '🔄 В процессе', priority: 'Высокий', assignee: 'Боб' },
  { task: 'Сквозные тесты', status: '⏳ Ожидает', priority: 'Средний', assignee: 'Каролина' },
];

function SampleTable() {
  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-sidebar-border/40">
      <div className="bg-sidebar-accent/30 px-3 py-2 text-[11px] font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
        Задачи проекта
      </div>
      <div className="overflow-x-auto">
        <Table className="w-full text-xs">
          <TableHeader>
            <TableRow className="border-b border-sidebar-border/20 bg-sidebar-accent/20 hover:bg-sidebar-accent/20">
              <TableHead className="px-3 py-2 font-semibold text-sidebar-foreground/70">Задача</TableHead>
              <TableHead className="px-3 py-2 font-semibold text-sidebar-foreground/70">Статус</TableHead>
              <TableHead className="px-3 py-2 font-semibold text-sidebar-foreground/70">Приоритет</TableHead>
              <TableHead className="px-3 py-2 font-semibold text-sidebar-foreground/70">Исполнитель</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sampleTableData.map((row, i) => (
              <TableRow
                key={i}
                className={cn(
                  'border-b border-sidebar-border/10',
                  i % 2 === 0 ? 'bg-sidebar-accent/10' : 'bg-transparent',
                  'hover:bg-sidebar-accent/20'
                )}
              >
                <TableCell className="max-w-[140px] truncate px-3 py-2 font-medium text-sidebar-foreground">
                  {row.task}
                </TableCell>
                <TableCell className="px-3 py-2 whitespace-nowrap text-sidebar-foreground/80">
                  {row.status}
                </TableCell>
                <TableCell className="px-3 py-2 whitespace-nowrap">
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      row.priority === 'Высокий' && 'bg-destructive/15 text-destructive',
                      row.priority === 'Средний' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                      row.priority === 'Низкий' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {row.priority}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2 text-sidebar-foreground/60">{row.assignee}</TableCell>
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
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const configSentRef = useRef('');
  const [showSampleTable, setShowSampleTable] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'send_data'>('chat');

  const [textData, setTextData] = useState('');
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    if (room?.name) {
      setRoomName(room.name);
    }
  }, [room]);

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
      alert('Данные отправлены!');
      setTextData('');
    } catch (error) {
      console.error('Error sending data over LiveKit:', error);
      alert('Не удалось отправить данные.');
    }
  };

  const sendConfigToRoom = useCallback(
    (key: string, endpoint: string) => {
      const participant = room?.localParticipant;
      if (!participant) return;
      const payload = JSON.stringify({
        key: key.trim() || undefined,
        endpoint: endpoint.trim() || undefined,
      });
      if (payload === configSentRef.current) return;
      configSentRef.current = payload;
      participant.publishData(new TextEncoder().encode(payload), {
        topic: 'prtlinternal',
      });
    },
    [room]
  );

  const fetchModels = useCallback(async (key: string, endpoint: string) => {
    const baseUrl = endpoint.trim() || 'https://lm.portalos.ru/v1/models';
    if (key.trim()) {
      try {
        const res = await fetch(baseUrl, {
          headers: { Authorization: `Bearer ${key.trim()}` },
        });
        if (res.ok) {
          const data = await res.json();
          const list: Model[] = (data.data ?? []).map((m: { id: string }) => ({
            id: m.id,
            name: m.id,
          }));
          setModels(list);
          if (list.length > 0)
            setSelectedModel((prev) => (prev && list.some((m) => m.id === prev) ? prev : list[0].id));
          return;
        }
      } catch {
        // fall through to server fallback
      }
    }
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      const list: Model[] = data.models ?? [];
      setModels(list);
      if (list.length > 0)
        setSelectedModel(list[0].id);
    } catch (e) {
      console.error('Error fetching models:', e);
    }
  }, []);

  useEffect(() => {
    if (apiKey && apiEndpoint) {
      fetchModels(apiKey, apiEndpoint);
    }
  }, [apiKey, apiEndpoint, fetchModels]);

  const filteredSessions = useMemo(() => {
    if (!search) return sessions;
    return sessions.filter((s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.preview.toLowerCase().includes(search.toLowerCase())
    );
  }, [sessions, search]);

  const grouped = useMemo(() => groupSessions(filteredSessions), [filteredSessions]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 220 }}
          className={cn(
            'fixed inset-0 z-50 flex h-svh w-1/2 flex-col',
            'min-w-80',
            'bg-sidebar text-sidebar-foreground',
            'border-r border-sidebar-border/40'
          )}
        >
          <SidebarProvider defaultOpen={true}>
            <ShadcnSidebar side="left" variant="sidebar" collapsible="none" className="w-full border-0">
              <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-accent">
                      <Brain className="size-5" />
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
                        isChatFullscreen
                          ? 'Выключить полноэкранный чат'
                          : 'Развернуть чат на весь экран'
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      className="rounded-md p-1.5"
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              </SidebarHeader>

              <div className="flex items-center gap-1 p-2 border-b border-sidebar-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('chat')}
                  className={cn(
                    'flex-1 gap-1.5 px-2 py-1.5 text-xs font-medium',
                    activeTab === 'chat'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
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
                    'flex-1 gap-1.5 px-2 py-1.5 text-xs font-medium',
                    activeTab === 'send_data'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <Send className="size-3.5" />
                  Отправить
                </Button>
              </div>

              {activeTab === 'send_data' ? (
                <SidebarContent className="p-4">
                  <SidebarGroup>
                    <SidebarGroupContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="sidebar-room-name">Название комнаты</Label>
                        <Input 
                          id="sidebar-room-name" 
                          placeholder="Введите название комнаты..." 
                          value={roomName}
                          onChange={(e) => setRoomName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sidebar-text-data">Данные</Label>
                        <div className="flex flex-col gap-2">
                          <textarea 
                            id="sidebar-text-data"
                            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Введите текст для отправки..."
                            value={textData}
                            onChange={(e) => setTextData(e.target.value)}
                          />
                          <Button 
                            onClick={handleSendData} 
                            className="w-full"
                            disabled={!textData}
                          >
                            Отправить данные
                          </Button>
                        </div>
                      </div>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </SidebarContent>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-sidebar-border/50">
                    <SidebarGroup>
                      <SidebarGroupContent className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between px-1">
                            <Label className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                              Модель
                            </Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] text-sidebar-foreground/60"
                              onClick={() => setShowSampleTable(!showSampleTable)}
                            >
                              {showSampleTable ? 'Скрыть' : 'Добавить таблицу'}
                            </Button>
                          </div>
                          <Select
                            value={selectedModel}
                            onValueChange={setSelectedModel}
                          >
                            <SelectTrigger className="h-8 border-sidebar-border/30 bg-sidebar-accent/20 text-xs">
                              <SelectValue placeholder="Выберите модель..." />
                            </SelectTrigger>
                            <SelectContent>
                              {models.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="size-3 text-sidebar-foreground/40" />
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

                  <div className="px-4 py-2.5 border-b border-sidebar-border/50">
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-sidebar-foreground/30" />
                      <Input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Поиск диалогов..."
                        className="border-sidebar-border/30 bg-sidebar-accent/20 py-1.5 pr-2.5 pl-8 text-xs placeholder:text-sidebar-foreground/30"
                      />
                    </div>
                  </div>

                  <SidebarContent className="p-3">
                    {showSampleTable && <SampleTable />}
                    {loading ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-20">
                        <div className="size-6 animate-spin rounded-full border-2 border-sidebar-border/40 border-t-sidebar-foreground/70" />
                        <span className="text-[11px] text-sidebar-foreground/40 animate-pulse">
                          Загрузка диалогов...
                        </span>
                      </div>
                    ) : filteredSessions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-20">
                        <div className="flex size-12 items-center justify-center rounded-full bg-sidebar-accent/50">
                          <History className="size-5 text-sidebar-foreground/30" />
                        </div>
                        <p className="px-4 text-center text-xs text-sidebar-foreground/40 leading-relaxed">
                          {search ? 'Нет диалогов по вашему запросу.' : 'Пока нет диалогов.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {grouped.map((group) => (
                          <SidebarGroup key={group.label}>
                            <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase tracking-wider text-[11px]">
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
                                        'group w-full rounded-lg p-3 text-left transition-all',
                                        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                        'border border-transparent hover:border-sidebar-border/30'
                                      )}
                                    >
                                      <div className="mb-1 flex items-center gap-2">
                                        <span className="flex-1 truncate text-sm font-medium">
                                          {session.title}
                                        </span>
                                        <span className="shrink-0 text-[10px] text-sidebar-foreground/25 opacity-0 transition-opacity group-hover:opacity-100">
                                          <Clock className="size-3" />
                                        </span>
                                      </div>
                                      <div className="text-sidebar-foreground/45 mb-1.5 line-clamp-2 text-xs leading-relaxed">
                                        {session.preview}
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[10px] text-sidebar-foreground/25">
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
            </ShadcnSidebar>
          </SidebarProvider>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
