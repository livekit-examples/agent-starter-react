'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from '@/components/ui/sidebar';
import { cn } from '@/lib/shadcn/utils';

const DAYS_OF_WEEK = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function CalendarView() {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDayOfWeek = new Date(year, month, 1).getDay();

  const weeks = useMemo(() => {
    const cells: (number | null)[][] = [];
    let week: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      week.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day);
      if (week.length === 7) {
        cells.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      cells.push(week);
    }
    return cells;
  }, [daysInMonth, startDayOfWeek]);

  const prevMonth = useCallback(() => {
    setViewDate(new Date(year, month - 1, 1));
  }, [year, month]);

  const nextMonth = useCallback(() => {
    setViewDate(new Date(year, month + 1, 1));
  }, [year, month]);

  const isToday = useCallback(
    (day: number) =>
      today.getFullYear() === year && today.getMonth() === month && today.getDate() === day,
    [today, year, month]
  );

  const isSelected = useCallback(
    (day: number) =>
      selectedDate?.getFullYear() === year &&
      selectedDate?.getMonth() === month &&
      selectedDate?.getDate() === day,
    [selectedDate, year, month]
  );

  const monthLabel = new Date(year, month).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <SidebarGroup>
      <SidebarGroupContent className="select-none">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-sidebar-foreground/70 text-xs font-semibold">{monthLabel}</span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={prevMonth}
              className="rounded-md p-1"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="rounded-md px-1.5 py-1 text-[10px] font-medium"
              aria-label="Сегодня"
            >
              Сегодня
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={nextMonth}
              className="rounded-md p-1"
              aria-label="Next month"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-0">
          {DAYS_OF_WEEK.map((d) => (
            <div
              key={d}
              className="text-sidebar-foreground/40 py-1.5 text-center text-[10px] font-semibold tracking-wider uppercase"
            >
              {d}
            </div>
          ))}
          {weeks.map((week, wi) =>
            week.map((day, di) => (
              <Button
                key={`${wi}-${di}`}
                variant="ghost"
                size="icon"
                disabled={day === null}
                onClick={() => day && setSelectedDate(new Date(year, month, day))}
                className={cn(
                  'mx-auto size-7 rounded-full text-[11px]',
                  day === null && 'pointer-events-none opacity-0',
                  !isSelected(day ?? 0) &&
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isSelected(day ?? 0) &&
                    'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent font-semibold',
                  isToday(day ?? 0) && !isSelected(day ?? 0) && 'ring-sidebar-foreground/30 ring-1'
                )}
              >
                {day}
              </Button>
            ))
          )}
        </div>

        {selectedDate && (
          <div className="border-sidebar-border/30 bg-sidebar-accent/20 mt-2 rounded-md border px-2.5 py-2">
            <p className="text-sidebar-foreground/60 text-[11px]">
              Selected:{' '}
              <span className="text-sidebar-foreground/80 font-semibold">
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </p>
            <Input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => {
                const d = new Date(e.target.value + 'T00:00:00');
                if (!isNaN(d.getTime())) {
                  setSelectedDate(d);
                  setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
                }
              }}
              className="border-sidebar-border/20 bg-sidebar-accent/30 mt-1.5 px-2 py-1 text-[11px] [color-scheme:dark]"
            />
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
