import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('projects').del();
  await knex('projects').insert([
    { id: 1, name: 'Platform Modernization', description: 'Migrate legacy monolith to microservices', department_id: 1, start_date: '2024-01-15', end_date: null, status: 'active' },
    { id: 2, name: 'Mobile App v2', description: 'Complete redesign of mobile application', department_id: 1, start_date: '2024-03-01', end_date: null, status: 'active' },
    { id: 3, name: 'Data Pipeline', description: 'Real-time analytics data pipeline', department_id: 1, start_date: '2024-06-01', end_date: null, status: 'active' },
    { id: 4, name: 'AI Assistant', description: 'Customer-facing AI chatbot', department_id: 1, start_date: '2024-09-01', end_date: null, status: 'active' },
    { id: 5, name: 'Design System 2.0', description: 'Unified component library and design tokens', department_id: 3, start_date: '2024-02-01', end_date: '2024-11-30', status: 'completed' },
    { id: 6, name: 'Enterprise Sales Portal', description: 'Self-service portal for enterprise clients', department_id: 4, start_date: '2024-04-15', end_date: null, status: 'active' },
    { id: 7, name: 'Brand Refresh', description: 'Company-wide rebrand initiative', department_id: 5, start_date: '2024-01-01', end_date: '2024-08-31', status: 'completed' },
    { id: 8, name: 'HRIS Migration', description: 'Migrate to new HR information system', department_id: 6, start_date: '2024-07-01', end_date: null, status: 'active' },
    { id: 9, name: 'SOC 2 Compliance', description: 'Achieve SOC 2 Type II certification', department_id: 1, start_date: '2024-01-01', end_date: '2024-12-31', status: 'completed' },
    { id: 10, name: 'Customer Onboarding Revamp', description: 'Streamline customer onboarding flow', department_id: 8, start_date: '2024-05-01', end_date: null, status: 'active' },
    { id: 11, name: 'Revenue Dashboard', description: 'Real-time revenue analytics dashboard', department_id: 7, start_date: '2024-08-01', end_date: null, status: 'active' },
    { id: 12, name: 'API Gateway', description: 'Centralized API management platform', department_id: 1, start_date: '2024-10-01', end_date: null, status: 'active' },
    { id: 13, name: 'Product-Led Growth', description: 'Self-serve trial and conversion optimization', department_id: 2, start_date: '2024-06-15', end_date: null, status: 'active' },
    { id: 14, name: 'Infrastructure Cost Optimization', description: 'Reduce cloud spend by 30%', department_id: 1, start_date: '2024-03-01', end_date: '2024-09-30', status: 'completed' },
    { id: 15, name: 'Knowledge Base', description: 'Internal knowledge management system', department_id: 8, start_date: '2024-11-01', end_date: null, status: 'active' },
  ]);
}
