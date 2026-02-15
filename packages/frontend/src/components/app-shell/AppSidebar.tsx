import { Database, MessageSquare, Settings } from 'lucide-react';
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

export type PageId = 'schema-explorer' | 'workspace' | 'settings';

type AppSidebarProps = {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
};

const navItems: { id: PageId; label: string; icon: typeof Database }[] = [
  { id: 'schema-explorer', label: 'Schema Explorer', icon: Database },
  { id: 'workspace', label: 'Workspace', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function AppSidebar({ activePage, onNavigate }: AppSidebarProps) {
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
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={item.id === activePage}
                    onClick={() => onNavigate(item.id)}
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
