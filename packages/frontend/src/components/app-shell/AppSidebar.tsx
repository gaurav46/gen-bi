import { useNavigate, useLocation } from 'react-router-dom';
import { Database, LayoutDashboard, MessageSquare, Settings } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
} from '@/components/ui/sidebar';

const navItems: { path: string; label: string; icon: typeof Database }[] = [
  { path: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
  { path: '/workspace', label: 'Workspace', icon: MessageSquare },
  { path: '/', label: 'Schema Explorer', icon: Database },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <span className="text-sm font-semibold">Gen BI</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive(item.path)}
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
