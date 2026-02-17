import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

function renderWithProviders(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

describe('AppSidebar', () => {
  it('renders all navigation items', () => {
    renderWithProviders();

    expect(screen.getByText('Schema Explorer')).toBeInTheDocument();
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('highlights the active navigation item based on current route', () => {
    renderWithProviders('/');

    const activeButton = screen.getByText('Schema Explorer').closest('[data-active="true"]');
    expect(activeButton).toBeInTheDocument();
  });

  it('highlights Dashboards when on a dashboard detail route', () => {
    renderWithProviders('/dashboards/d1');

    const activeButton = screen.getByText('Dashboards').closest('[data-active="true"]');
    expect(activeButton).toBeInTheDocument();
  });
});
