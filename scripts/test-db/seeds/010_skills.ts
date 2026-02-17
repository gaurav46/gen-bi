import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('skills').del();
  await knex('skills').insert([
    { id: 1, name: 'TypeScript', category: 'Programming' },
    { id: 2, name: 'Python', category: 'Programming' },
    { id: 3, name: 'Java', category: 'Programming' },
    { id: 4, name: 'Go', category: 'Programming' },
    { id: 5, name: 'React', category: 'Frontend' },
    { id: 6, name: 'Vue.js', category: 'Frontend' },
    { id: 7, name: 'Angular', category: 'Frontend' },
    { id: 8, name: 'Node.js', category: 'Backend' },
    { id: 9, name: 'PostgreSQL', category: 'Database' },
    { id: 10, name: 'MongoDB', category: 'Database' },
    { id: 11, name: 'AWS', category: 'Cloud' },
    { id: 12, name: 'Azure', category: 'Cloud' },
    { id: 13, name: 'Docker', category: 'DevOps' },
    { id: 14, name: 'Kubernetes', category: 'DevOps' },
    { id: 15, name: 'CI/CD', category: 'DevOps' },
    { id: 16, name: 'Figma', category: 'Design' },
    { id: 17, name: 'UX Research', category: 'Design' },
    { id: 18, name: 'Agile/Scrum', category: 'Methodology' },
    { id: 19, name: 'Project Management', category: 'Methodology' },
    { id: 20, name: 'Data Analysis', category: 'Analytics' },
    { id: 21, name: 'Machine Learning', category: 'AI' },
    { id: 22, name: 'REST API Design', category: 'Architecture' },
    { id: 23, name: 'GraphQL', category: 'Architecture' },
    { id: 24, name: 'Microservices', category: 'Architecture' },
    { id: 25, name: 'System Design', category: 'Architecture' },
    { id: 26, name: 'Technical Writing', category: 'Communication' },
    { id: 27, name: 'Salesforce', category: 'CRM' },
    { id: 28, name: 'HubSpot', category: 'CRM' },
    { id: 29, name: 'Financial Modeling', category: 'Finance' },
    { id: 30, name: 'People Management', category: 'Leadership' },
  ]);
}
