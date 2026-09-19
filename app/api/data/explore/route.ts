import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 0;

interface SampleRow {
  [key: string]: unknown;
}

interface SampleTable {
  columns: string[];
  types: Record<string, string>;
  rows: SampleRow[];
}

const sampleData: Record<string, SampleTable> = {
  tasks: {
    columns: ['id', 'task', 'status', 'priority', 'assignee', 'created_at'],
    types: { id: 'integer', created_at: 'datetime' },
    rows: [
      {
        id: 1,
        task: 'Implement auth middleware',
        status: 'Done',
        priority: 'High',
        assignee: 'Alice',
        created_at: '2026-06-01T09:15:00Z',
      },
      {
        id: 2,
        task: 'Write API documentation',
        status: 'In Progress',
        priority: 'Medium',
        assignee: 'Bob',
        created_at: '2026-06-02T14:30:00Z',
      },
      {
        id: 3,
        task: 'Fix login redirect bug',
        status: 'Done',
        priority: 'High',
        assignee: 'Alice',
        created_at: '2026-06-03T11:00:00Z',
      },
      {
        id: 4,
        task: 'Design dashboard layout',
        status: 'Pending',
        priority: 'Low',
        assignee: 'Carol',
        created_at: '2026-06-04T08:45:00Z',
      },
      {
        id: 5,
        task: 'Database migration script',
        status: 'In Progress',
        priority: 'High',
        assignee: 'Bob',
        created_at: '2026-06-05T16:20:00Z',
      },
      {
        id: 6,
        task: 'End-to-end tests',
        status: 'Pending',
        priority: 'Medium',
        assignee: 'Carol',
        created_at: '2026-06-06T10:00:00Z',
      },
      {
        id: 7,
        task: 'Set up CI/CD pipeline',
        status: 'Done',
        priority: 'High',
        assignee: 'Alice',
        created_at: '2026-06-07T13:15:00Z',
      },
      {
        id: 8,
        task: 'User research interviews',
        status: 'In Progress',
        priority: 'Low',
        assignee: 'Carol',
        created_at: '2026-06-08T09:30:00Z',
      },
      {
        id: 9,
        task: 'Performance optimization',
        status: 'Pending',
        priority: 'Medium',
        assignee: 'Bob',
        created_at: '2026-06-09T15:45:00Z',
      },
      {
        id: 10,
        task: 'Security audit',
        status: 'Pending',
        priority: 'High',
        assignee: 'Alice',
        created_at: '2026-06-10T07:00:00Z',
      },
      {
        id: 11,
        task: 'Mobile responsive fixes',
        status: 'In Progress',
        priority: 'Medium',
        assignee: 'Carol',
        created_at: '2026-06-11T12:30:00Z',
      },
      {
        id: 12,
        task: 'API rate limiting',
        status: 'Done',
        priority: 'High',
        assignee: 'Bob',
        created_at: '2026-06-12T18:00:00Z',
      },
    ],
  },
  users: {
    columns: ['id', 'name', 'email', 'role', 'active', 'created_at'],
    types: { id: 'integer', active: 'boolean', created_at: 'datetime' },
    rows: [
      {
        id: 1,
        name: 'Alice Johnson',
        email: 'alice@example.com',
        role: 'Admin',
        active: true,
        created_at: '2026-01-15T08:00:00Z',
      },
      {
        id: 2,
        name: 'Bob Smith',
        email: 'bob@example.com',
        role: 'Developer',
        active: true,
        created_at: '2026-02-20T10:30:00Z',
      },
      {
        id: 3,
        name: 'Carol Williams',
        email: 'carol@example.com',
        role: 'Designer',
        active: true,
        created_at: '2026-03-10T14:15:00Z',
      },
      {
        id: 4,
        name: 'Dave Brown',
        email: 'dave@example.com',
        role: 'Developer',
        active: false,
        created_at: '2026-04-05T09:00:00Z',
      },
      {
        id: 5,
        name: 'Eve Davis',
        email: 'eve@example.com',
        role: 'Manager',
        active: true,
        created_at: '2026-05-01T11:45:00Z',
      },
    ],
  },
  orders: {
    columns: ['id', 'product', 'amount', 'status', 'customer', 'date'],
    types: { id: 'integer', amount: 'number', date: 'datetime' },
    rows: [
      {
        id: 101,
        product: 'Wireless Headphones',
        amount: 79.99,
        status: 'Shipped',
        customer: 'Acme Corp',
        date: '2026-06-01T10:00:00Z',
      },
      {
        id: 102,
        product: 'USB-C Hub',
        amount: 34.5,
        status: 'Processing',
        customer: 'Globex Inc',
        date: '2026-06-02T15:30:00Z',
      },
      {
        id: 103,
        product: 'Mechanical Keyboard',
        amount: 149.0,
        status: 'Delivered',
        customer: 'Initech',
        date: '2026-05-28T12:00:00Z',
      },
      {
        id: 104,
        product: '27" Monitor',
        amount: 399.99,
        status: 'Shipped',
        customer: 'Acme Corp',
        date: '2026-06-03T09:15:00Z',
      },
      {
        id: 105,
        product: 'Webcam HD',
        amount: 89.99,
        status: 'Pending',
        customer: 'Umbrella Co',
        date: '2026-06-04T14:45:00Z',
      },
      {
        id: 106,
        product: 'Desk Lamp',
        amount: 45.0,
        status: 'Processing',
        customer: 'Globex Inc',
        date: '2026-06-05T11:30:00Z',
      },
      {
        id: 107,
        product: 'Ergonomic Chair',
        amount: 599.0,
        status: 'Delivered',
        customer: 'Initech',
        date: '2026-05-20T08:00:00Z',
      },
      {
        id: 108,
        product: 'Noise Cancelling Earbuds',
        amount: 199.99,
        status: 'Shipped',
        customer: 'Acme Corp',
        date: '2026-06-06T16:00:00Z',
      },
    ],
  },
};

const sampleTables = Object.keys(sampleData);

const DATABASE_URL = process.env.DATABASE_URL;

function isDateValue(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  return !isNaN(Date.parse(v));
}

function parseDateSafe(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchLiveTables(): Promise<string[]> {
  const url = DATABASE_URL!;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Upstream responded with ${res.status}`);
  const body = await res.json();
  if (Array.isArray(body)) return body;
  if (body.tables && Array.isArray(body.tables)) return body.tables;
  if (typeof body === 'object' && body !== null) return Object.keys(body);
  return [];
}

async function fetchLiveTableData(
  table: string,
  opts: {
    search?: string;
    page?: number;
    pageSize?: number;
    sort?: string;
    sortDir?: string;
    dateColumn?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<{ columns: string[]; types: Record<string, string>; rows: SampleRow[]; total: number }> {
  const params = new URLSearchParams({ table });
  if (opts.search) params.set('search', opts.search);
  if (opts.page !== undefined) params.set('page', String(opts.page));
  if (opts.pageSize !== undefined) params.set('pageSize', String(opts.pageSize));
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.sortDir) params.set('sortDir', opts.sortDir);
  if (opts.dateColumn) params.set('dateColumn', opts.dateColumn);
  if (opts.dateFrom) params.set('dateFrom', opts.dateFrom);
  if (opts.dateTo) params.set('dateTo', opts.dateTo);

  const url = `${DATABASE_URL!.replace(/\/+$/, '')}?${params.toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Upstream responded with ${res.status}`);
  const body = await res.json();

  if (body.columns && body.rows) {
    return {
      columns: body.columns,
      types: body.types ?? body.columnTypes ?? {},
      rows: body.rows,
      total: body.total ?? body.rows.length,
    };
  }
  if (Array.isArray(body)) {
    const rows = body as SampleRow[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const types: Record<string, string> = {};
    if (rows.length > 0) {
      for (const col of columns) {
        const v = rows[0][col];
        if (typeof v === 'number') types[col] = Number.isInteger(v) ? 'integer' : 'number';
        else if (typeof v === 'boolean') types[col] = 'boolean';
        else if (isDateValue(v)) types[col] = 'datetime';
        else types[col] = 'string';
      }
    }
    return { columns, types, rows, total: rows.length };
  }
  return { columns: [], types: {}, rows: [], total: 0 };
}

function applyDateFilter(
  rows: SampleRow[],
  column: string,
  dateFrom?: string,
  dateTo?: string
): SampleRow[] {
  let filtered = rows;
  if (dateFrom) {
    const from = new Date(dateFrom);
    if (!isNaN(from.getTime())) {
      filtered = filtered.filter((row) => {
        const d = parseDateSafe(row[column]);
        return d && d >= from;
      });
    }
  }
  if (dateTo) {
    const to = new Date(dateTo);
    if (!isNaN(to.getTime())) {
      filtered = filtered.filter((row) => {
        const d = parseDateSafe(row[column]);
        return d && d <= to;
      });
    }
  }
  return filtered;
}

function applySort(rows: SampleRow[], column: string, dir: 'asc' | 'desc'): SampleRow[] {
  return [...rows].sort((a, b) => {
    const va = a[column];
    const vb = b[column];
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;

    // Date comparison
    const da = parseDateSafe(va);
    const db = parseDateSafe(vb);
    if (da && db) return dir === 'asc' ? da.getTime() - db.getTime() : db.getTime() - da.getTime();

    // Numeric comparison
    if (typeof va === 'number' && typeof vb === 'number') {
      return dir === 'asc' ? va - vb : vb - va;
    }

    // String comparison
    const sa = String(va);
    const sb = String(vb);
    return dir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const search = searchParams.get('search') || undefined;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const pageSize = searchParams.get('pageSize')
      ? Number(searchParams.get('pageSize'))
      : undefined;
    const sort = searchParams.get('sort') || undefined;
    const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc') || undefined;
    const dateColumn = searchParams.get('dateColumn') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;

    if (DATABASE_URL) {
      try {
        if (!table) {
          const tables = await fetchLiveTables();
          return NextResponse.json({ source: 'live', tables });
        }
        const data = await fetchLiveTableData(table, {
          search,
          page,
          pageSize,
          sort,
          sortDir,
          dateColumn,
          dateFrom,
          dateTo,
        });
        return NextResponse.json({
          source: 'live',
          columns: data.columns,
          types: data.types,
          rows: data.rows,
          total: data.total,
          table,
        });
      } catch {
        return NextResponse.json(
          { error: 'Failed to connect to the external database. Check DATABASE_URL.' },
          { status: 502 }
        );
      }
    }

    // Sample data fallback
    if (!table) {
      return NextResponse.json({ source: 'sample', tables: sampleTables });
    }

    const sample = sampleData[table];
    if (!sample) {
      return NextResponse.json({ error: `Table "${table}" not found` }, { status: 404 });
    }

    let filtered = sample.rows;

    // Apply date range filter
    if ((dateFrom || dateTo) && dateColumn) {
      filtered = applyDateFilter(filtered, dateColumn, dateFrom, dateTo);
    }

    // Apply search filter
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((row) =>
        Object.values(row).some((v) =>
          String(v ?? '')
            .toLowerCase()
            .includes(q)
        )
      );
    }

    // Apply sorting
    if (sort && sortDir) {
      filtered = applySort(filtered, sort, sortDir);
    }

    const total = filtered.length;
    const safePage = page && page > 0 ? page : 1;
    const safePageSize = pageSize && pageSize > 0 ? pageSize : 50;
    const start = (safePage - 1) * safePageSize;
    const paged = filtered.slice(start, start + safePageSize);

    return NextResponse.json({
      source: 'sample',
      columns: sample.columns,
      types: sample.types,
      rows: paged,
      total,
      table,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
