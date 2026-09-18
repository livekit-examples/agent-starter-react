'use client';

import { useState } from 'react';
import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  MessageSquareTextIcon,
  XIcon,
} from 'lucide-react';
import { DataExplorer } from '@/components/app/data-explorer';
import { PlateEditor } from '@/components/app/plate-editor';
import { CalendarView } from '@/components/app/sidebar-calendar';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { SidebarContent, SidebarHeader } from '@/components/ui/sidebar';
import { cn } from '@/lib/shadcn/utils';

interface RightSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function RightSidebar({ open, onClose }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'calendar' | 'dashboard' | 'editor'>('chat');

  return (
    <Drawer open={open} onClose={onClose} side="right" className="w-full md:w-[420px]">
      <SidebarHeader className="border-sidebar-border from-sidebar to-sidebar/95 border-b bg-gradient-to-r px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('chat')}
            className={cn(
              'gap-1.5 px-2.5 py-1.5 text-xs font-medium',
              activeTab === 'chat'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
            )}
          >
            <MessageSquareTextIcon className="size-3.5" />
            Примеры
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('calendar')}
            className={cn(
              'gap-1.5 px-2.5 py-1.5 text-xs font-medium',
              activeTab === 'calendar'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
            )}
          >
            <CalendarDays className="size-3.5" />
            Календарь
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              'gap-1.5 px-2.5 py-1.5 text-xs font-medium',
              activeTab === 'dashboard'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
            )}
          >
            <LayoutDashboard className="size-3.5" />
            Панель
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('editor')}
            className={cn(
              'gap-1.5 px-2.5 py-1.5 text-xs font-medium',
              activeTab === 'editor'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
            )}
          >
            <FileText className="size-3.5" />
            Редактор
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-md p-1.5">
            <XIcon className="size-4" />
          </Button>
        </div>
      </SidebarHeader>

      {activeTab === 'calendar' && (
        <SidebarContent className="p-3">
          <CalendarView />
        </SidebarContent>
      )}

      {activeTab === 'dashboard' && (
        <iframe
          src={process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://portalos.ru'}
          className="w-full flex-1 border-0"
          title="Панель управления"
        />
      )}

      {activeTab === 'editor' && (
        <SidebarContent className="p-3">
          <PlateEditor />
        </SidebarContent>
      )}

      {activeTab === 'chat' && (
        <SidebarContent className="p-3">
          <DataExplorer />
        </SidebarContent>
      )}
    </Drawer>
  );
}
