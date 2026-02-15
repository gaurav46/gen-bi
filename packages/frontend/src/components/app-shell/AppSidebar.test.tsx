import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

function renderWithProvider(ui: React.ReactElement) {
  return render(<SidebarProvider>{ui}</SidebarProvider>);
}

describe('AppSidebar', () => {
  it('renders Schema Explorer and Settings navigation items', () => {
    renderWithProvider(<AppSidebar activePage="schema-explorer" onNavigate={vi.fn()} />);

    expect(screen.getByText('Schema Explorer')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('calls onNavigate when nav item is clicked', async () => {
    const onNavigate = vi.fn();
    renderWithProvider(<AppSidebar activePage="schema-explorer" onNavigate={onNavigate} />);

    await userEvent.click(screen.getByText('Settings'));
    expect(onNavigate).toHaveBeenCalledWith('settings');
  });

  it('highlights the active navigation item', () => {
    renderWithProvider(<AppSidebar activePage="schema-explorer" onNavigate={vi.fn()} />);

    const activeButton = screen.getByText('Schema Explorer').closest('[data-active="true"]');
    expect(activeButton).toBeInTheDocument();
  });

  it('renders Workspace nav item', () => {
    renderWithProvider(<AppSidebar activePage="schema-explorer" onNavigate={vi.fn()} />);

    expect(screen.getByText('Workspace')).toBeInTheDocument();
  });
});
