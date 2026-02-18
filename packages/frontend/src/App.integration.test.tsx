import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

const mockQueryResponse = {
  intent: 'top_customers',
  title: 'Top Customers by Revenue',
  sql: 'SELECT name, SUM(total) FROM customers GROUP BY name ORDER BY SUM(total) DESC LIMIT 10',
  visualization: { chartType: 'bar' },
  columns: [
    { name: 'name', type: 'varchar', role: 'dimension' },
    { name: 'total', type: 'numeric', role: 'measure' },
  ],
  rows: [
    { name: 'Alice', total: 12500 },
    { name: 'Bob', total: 8200 },
  ],
  attempts: 1,
};

const mockTables = [
  {
    id: 't1', connectionId: 'conn-1', schemaName: 'public', tableName: 'users',
    columns: [
      { columnName: 'id', dataType: 'int4', isNullable: false, ordinalPosition: 1 },
      { columnName: 'email', dataType: 'varchar', isNullable: false, ordinalPosition: 2 },
      { columnName: 'name', dataType: 'varchar', isNullable: true, ordinalPosition: 3 },
    ],
    foreignKeys: [],
    indexes: [{ indexName: 'users_pkey', columnName: 'id', isUnique: true }],
  },
  {
    id: 't2', connectionId: 'conn-1', schemaName: 'public', tableName: 'orders',
    columns: [
      { columnName: 'id', dataType: 'int4', isNullable: false, ordinalPosition: 1 },
      { columnName: 'user_id', dataType: 'int4', isNullable: false, ordinalPosition: 2 },
      { columnName: 'total', dataType: 'numeric', isNullable: true, ordinalPosition: 3 },
    ],
    foreignKeys: [{ columnName: 'user_id', foreignTableSchema: 'public', foreignTableName: 'users', foreignColumnName: 'id', constraintName: 'orders_user_id_fkey' }],
    indexes: [{ indexName: 'orders_pkey', columnName: 'id', isUnique: true }],
  },
];

describe('App Integration', () => {
  const mockDashboards = [
    { id: 'd1', name: 'Sales KPIs', widgetCount: 2, createdAt: '2025-01-01' },
  ];

  const mockWidget = {
    id: 'w1', dashboardId: 'd1', title: 'Top Customers by Revenue',
    sql: mockQueryResponse.sql, chartType: 'bar',
    columns: mockQueryResponse.columns, position: 2, createdAt: '2025-01-01',
  };

  const mockDashboardDetail = {
    id: 'd1',
    name: 'Sales KPIs',
    widgets: [
      { id: 'w1', dashboardId: 'd1', title: 'Revenue Chart', sql: 'SELECT 1', chartType: 'bar', columns: [{ name: 'name', type: 'varchar', role: 'dimension' }, { name: 'total', type: 'numeric', role: 'measure' }], position: 0, createdAt: '2025-01-01' },
      { id: 'w2', dashboardId: 'd1', title: 'Failing Widget', sql: 'SELECT bad', chartType: 'bar', columns: [], position: 1, createdAt: '2025-01-01' },
    ],
  };

  const mockExecutionResult = {
    columns: [{ name: 'name', type: 'varchar', role: 'dimension' }, { name: 'total', type: 'numeric', role: 'measure' }],
    rows: [{ name: 'Alice', total: 100 }],
  };

  beforeEach(() => {
    localStorage.setItem('connectionId', 'conn-1');
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/schema/') && url.includes('/rows')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ rows: [], totalRows: 0, page: 1, pageSize: 25, primaryKeyColumns: [] }) });
      }
      if (url.includes('/api/schema/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTables) });
      }
      if (url.includes('/api/connections/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'conn-1', host: 'localhost' }) });
      }
      if (url === '/api/query') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQueryResponse) });
      }
      if (url.includes('/execute') && options?.method === 'POST') {
        if (url.includes('/w2/')) {
          return Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error' });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockExecutionResult) });
      }
      if (url.includes('/api/dashboards/') && url.includes('/widgets') && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockWidget) });
      }
      if (url.match(/\/api\/dashboards\/\w+\/widgets\/\w+$/) && options?.method === 'DELETE') {
        return Promise.resolve({ ok: true });
      }
      if (url.match(/\/api\/dashboards\/\w+$/) && options?.method === 'DELETE') {
        return Promise.resolve({ ok: true });
      }
      if (url.match(/\/api\/dashboards\/\w+$/) && (!options || !options.method || options.method === 'GET')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDashboardDetail) });
      }
      if (url.includes('/api/dashboards') && (!options || !options.method || options.method === 'GET')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDashboards) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
  });

  it('user browses schema explorer: sees tables, searches, views column detail', async () => {
    render(<MemoryRouter><App /></MemoryRouter>);

    expect(screen.getByText('Schema Explorer')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument();
    });
    expect(screen.getByText('orders')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search tables...');
    await userEvent.type(searchInput, 'orders');

    await waitFor(() => {
      expect(screen.queryByText('users')).not.toBeInTheDocument();
    });
    expect(screen.getByText('orders')).toBeInTheDocument();

    await userEvent.click(screen.getByText('orders'));

    expect(screen.getByText('user_id')).toBeInTheDocument();
    expect(screen.getByText('numeric')).toBeInTheDocument();
    expect(screen.getByText('users.id')).toBeInTheDocument();
    expect(screen.getByText('PK')).toBeInTheDocument();
  });

  it('user navigates to Workspace, types a question, sees chart', async () => {
    render(<MemoryRouter><App /></MemoryRouter>);

    await userEvent.click(screen.getByText('Workspace'));

    const input = screen.getByPlaceholderText('Ask a question...');
    await userEvent.type(input, 'Show top customers');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByText('Top Customers by Revenue')).toBeInTheDocument();
    });
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('user adds a query result to an existing dashboard', async () => {
    render(<MemoryRouter><App /></MemoryRouter>);

    await userEvent.click(screen.getByText('Workspace'));

    const input = screen.getByPlaceholderText('Ask a question...');
    await userEvent.type(input, 'Show top customers');
    await userEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /add to dashboard/i }));

    await waitFor(() => {
      expect(screen.getByText('Sales KPIs')).toBeInTheDocument();
    });
    expect(screen.getByText('Create Dashboard')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Sales KPIs'));

    await waitFor(() => {
      expect(screen.getByText(/added/i)).toBeInTheDocument();
    });

    const fetchCalls = (fetch as any).mock.calls;
    const addWidgetCall = fetchCalls.find(
      (call: any[]) => call[0].includes('/api/dashboards/d1/widgets') && call[1]?.method === 'POST',
    );
    expect(addWidgetCall).toBeTruthy();
    const body = JSON.parse(addWidgetCall[1].body);
    expect(body.title).toBe('Top Customers by Revenue');
    expect(body.sql).toBe(mockQueryResponse.sql);
    expect(body.chartType).toBe('bar');
    expect(body.columns).toEqual(mockQueryResponse.columns);
  });

  it('user views dashboards, opens detail, removes widget, deletes dashboard', async () => {
    render(<MemoryRouter><App /></MemoryRouter>);

    await userEvent.click(screen.getByText('Dashboards'));

    await waitFor(() => {
      expect(screen.getByText('Sales KPIs')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Sales KPIs'));

    await waitFor(() => {
      expect(screen.getByText('Revenue Chart')).toBeInTheDocument();
    });
    expect(screen.getByText('Failing Widget')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await userEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('Revenue Chart')).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByText('Sales KPIs')).toBeInTheDocument();
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => {
      expect(screen.queryByText('Sales KPIs')).not.toBeInTheDocument();
    });
  });

  it('opening /dashboards/d1 directly loads the dashboard detail page', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboards/d1']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Revenue Chart')).toBeInTheDocument();
    });
    expect(screen.getByText('Failing Widget')).toBeInTheDocument();
  });
});
