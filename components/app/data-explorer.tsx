'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpNarrowWide,
  ChevronLeft,
  ChevronRight,
  Database,
  Loader2,
  Search,
  Table2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
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
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/shadcn/utils';

interface TableInfo {
  source: 'sample' | 'live';
  tables: string[];
}

interface TableData {
  source: 'sample' | 'live';
  columns: string[];
  types?: Record<string, string>;
  rows: Record<string, unknown>[];
  total: number;
  table: string;
}

interface SortState {
  column: string;
  dir: 'asc' | 'desc';
}

const PAGE_SIZE = 15;

function isDateColumn(col: string, types?: Record<string, string>): boolean {
  if (types?.[col] === 'datetime' || types?.[col] === 'date' || types?.[col] === 'timestamp')
    return true;
  const lower = col.toLowerCase();
  return lower.includes('date') || lower.includes('_at') || lower === 'timestamp';
}

export function DataExplorer() {
  const [tables, setTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string>('');
  const [data, setData] = useState<TableData | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'sample' | 'live'>('sample');
  const [sort, setSort] = useState<SortState | null>(null);
  const [dateColumn, setDateColumn] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Detect available date columns from current data
  const dateColumns = useMemo(() => {
    if (!data?.columns) return [];
    return data.columns.filter((col) => isDateColumn(col, data.types));
  }, [data]);

  // Fetch table list on mount
  useEffect(() => {
    fetch('/api/data/explore')
      .then((r) => r.json())
      .then((info: TableInfo) => {
        setTables(info.tables);
        setSource(info.source);
        if (info.tables.length > 0 && !activeTable) setActiveTable(info.tables[0]);
      })
      .catch(() => setError('Не удалось загрузить таблицы'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch table data
  const fetchData = useCallback(async () => {
    if (!activeTable) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        table: activeTable,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) params.set('search', search);
      if (sort) {
        params.set('sort', sort.column);
        params.set('sortDir', sort.dir);
      }
      if (dateColumn && (dateFrom || dateTo)) {
        params.set('dateColumn', dateColumn);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
      }
      const res = await fetch(`/api/data/explore?${params}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${res.status})`);
      }
      const d: TableData = await res.json();
      setData(d);
      setSource(d.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeTable, search, page, sort, dateColumn, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTableChange = (table: string) => {
    setActiveTable(table);
    setPage(1);
    setSearch('');
    setSearchInput('');
    setSort(null);
    setDateColumn(null);
    setDateFrom('');
    setDateTo('');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleSort = (column: string) => {
    setSort((prev) => {
      if (prev?.column === column) {
        return prev.dir === 'asc' ? { column, dir: 'desc' } : null;
      }
      return { column, dir: 'asc' };
    });
    setPage(1);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex h-full flex-col gap-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Database className="text-sidebar-foreground/50 size-3.5" />
          <span className="text-sidebar-foreground/50 text-[11px] font-semibold tracking-wider uppercase">
            Обозреватель данных
          </span>
          <Badge
            variant={source === 'live' ? 'default' : 'secondary'}
            className={cn(
              'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
              source === 'live'
                ? 'border-emerald-500/20 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'border-amber-500/20 bg-amber-500/15 text-amber-600 dark:text-amber-400'
            )}
          >
            {source === 'live' ? 'В реальном времени' : 'Пример'}
          </Badge>
        </div>

        {/* Table selector */}
        <SidebarMenu className="flex-row flex-wrap gap-1">
          {tables.map((t) => (
            <SidebarMenuItem key={t} className="list-none">
              <SidebarMenuButton
                size="sm"
                isActive={activeTable === t}
                onClick={() => handleTableChange(t)}
                className="h-auto gap-1 px-2 py-1 text-[11px] font-medium"
              >
                <Table2 className="size-3" />
                {t}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="text-sidebar-foreground/40 pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2" />
          <SidebarInput
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Поиск строк..."
            className="pr-2 pl-7 text-xs"
          />
        </form>

        {/* Date range filter */}
        {dateColumns.length > 0 && (
          <Card className="border-sidebar-border/30 bg-sidebar-accent/10 shadow-none">
            <CardContent className="flex flex-col gap-1.5 p-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sidebar-foreground/50 text-[10px] font-medium uppercase">
                  Фильтр по дате
                </span>
                <Select
                  value={dateColumn ?? ''}
                  onValueChange={(val) => {
                    setDateColumn(val || null);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className="border-sidebar-border/30 bg-sidebar-accent/30 text-sidebar-foreground ml-auto h-auto px-1.5 py-0.5 text-[10px] [&_svg]:size-3"
                  >
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {dateColumns.map((col) => (
                      <SelectItem key={col} value={col} className="text-xs">
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {dateColumn && (
                <div className="flex items-center gap-1">
                  <SidebarInput
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                    className="h-auto px-1.5 py-1 text-[10px] [color-scheme:dark]"
                  />
                  <span className="text-sidebar-foreground/40 text-[10px]">→</span>
                  <SidebarInput
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                    className="h-auto px-1.5 py-1 text-[10px] [color-scheme:dark]"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Content */}
        <div className="min-h-0 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-sidebar-foreground/40 size-5 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <Database className="text-destructive/40 size-6" />
              <p className="text-destructive/70 text-center text-xs leading-relaxed">{error}</p>
            </div>
          ) : data && data.columns.length > 0 ? (
            <div className="border-sidebar-border/40 overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
                <Table className="w-full text-xs">
                  <TableHeader>
                    <TableRow className="border-sidebar-border/20 bg-sidebar-accent/20 hover:bg-sidebar-accent/20 border-b">
                      {data.columns.map((col) => (
                        <TableHead key={col} className="px-2 py-1.5">
                          <Toggle
                            size="sm"
                            pressed={sort?.column === col}
                            onPressedChange={() => handleSort(col)}
                            className={cn(
                              '-ml-1 h-auto min-w-0 gap-1 px-1.5 text-xs font-semibold',
                              sort?.column === col
                                ? 'text-sidebar-foreground'
                                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
                            )}
                          >
                            {col}
                            {sort?.column === col ? (
                              sort.dir === 'asc' ? (
                                <ArrowUpNarrowWide className="size-3 shrink-0" />
                              ) : (
                                <ArrowDownWideNarrow className="size-3 shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown className="size-3 shrink-0 opacity-30" />
                            )}
                          </Toggle>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((row, i) => (
                      <TableRow
                        key={i}
                        className={cn(
                          'border-sidebar-border/10 border-b',
                          i % 2 === 0 ? 'bg-sidebar-accent/10' : 'bg-transparent',
                          'hover:bg-sidebar-accent/20'
                        )}
                      >
                        {data.columns.map((col) => {
                          const val = row[col];
                          return (
                            <TableCell
                              key={col}
                              className={cn(
                                'max-w-[160px] truncate px-2 py-1.5',
                                isDateColumn(col, data.types)
                                  ? 'text-sidebar-foreground/60 font-mono text-[10px]'
                                  : 'text-sidebar-foreground/80'
                              )}
                              title={String(val ?? '')}
                            >
                              {formatCellValue(val)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : data ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Table2 className="text-sidebar-foreground/20 size-6" />
              <p className="text-sidebar-foreground/30 text-center text-xs leading-relaxed">
                Данные не найдены
              </p>
            </div>
          ) : null}
        </div>

        {/* Pagination */}
        {data && data.total > PAGE_SIZE && (
          <div className="border-sidebar-border/20 flex items-center justify-between border-t pt-2">
            <span className="text-sidebar-foreground/40 text-[10px]">
              {data.total} {data.total === 1 ? 'строка' : data.total < 5 ? 'строки' : 'строк'}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded p-1"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="text-sidebar-foreground/50 min-w-[4ch] text-center text-[10px]">
                {page}/{totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded p-1"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toFixed(2);
  }
  if (typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('T')) {
    const d = new Date(value);
    return d.toLocaleString('ru-RU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return String(value);
}
