import { Knex } from 'knex';

const firstNames = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Lisa', 'Daniel', 'Nancy',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Dorothy', 'Paul', 'Kimberly', 'Andrew', 'Emily', 'Joshua', 'Donna',
  'Kenneth', 'Michelle', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa',
  'Timothy', 'Deborah', 'Ronald', 'Stephanie', 'Edward', 'Rebecca', 'Jason', 'Sharon',
  'Jeffrey', 'Laura', 'Ryan', 'Cynthia', 'Jacob', 'Kathleen', 'Gary', 'Amy',
  'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna', 'Stephen', 'Brenda',
  'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
  'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Raymond', 'Christine', 'Gregory', 'Debra',
  'Frank', 'Rachel', 'Alexander', 'Carolyn', 'Patrick', 'Janet', 'Jack', 'Catherine',
  'Dennis', 'Maria', 'Jerry', 'Heather', 'Tyler', 'Diane', 'Aaron', 'Ruth',
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
  'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
  'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy',
  'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey',
  'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza',
  'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers',
  'Long', 'Ross', 'Foster', 'Jimenez',
];

function randomDate(start: string, end: string): string {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s)).toISOString().split('T')[0];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  hire_date: string;
  department_id: number;
  position_id: number;
  manager_id: number | null;
  office_location_id: number;
  status: string;
}

// Department -> position mappings
const deptPositions: Record<number, number[]> = {
  1: [6, 7, 8, 9],    // Engineering
  2: [10, 11],         // Product
  3: [12, 13, 14],     // Design
  4: [15, 16, 17],     // Sales
  5: [18, 19],         // Marketing
  6: [20, 21],         // HR
  7: [22, 23],         // Finance
  8: [24, 25],         // Customer Success
};

const deptLocations: Record<number, number> = {
  1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 1, 7: 2, 8: 3,
};

// Target headcount per department (totals ~200 with leadership)
const deptHeadcount: Record<number, number> = {
  1: 80, 2: 20, 3: 15, 4: 25, 5: 15, 6: 10, 7: 12, 8: 15,
};

export async function seed(knex: Knex): Promise<void> {
  await knex('employee_skills').del();
  await knex('benefits').del();
  await knex('performance_reviews').del();
  await knex('project_assignments').del();
  await knex('leaves').del();
  await knex('salaries').del();
  await knex('employees').del();

  const employees: Employee[] = [];
  const usedEmails = new Set<string>();
  let id = 1;

  function makeEmail(first: string, last: string): string {
    let email = `${first.toLowerCase()}.${last.toLowerCase()}@techcorp.com`;
    let suffix = 1;
    while (usedEmails.has(email)) {
      email = `${first.toLowerCase()}.${last.toLowerCase()}${suffix}@techcorp.com`;
      suffix++;
    }
    usedEmails.add(email);
    return email;
  }

  function makePhone(): string {
    const area = Math.floor(200 + Math.random() * 800);
    const mid = Math.floor(100 + Math.random() * 900);
    const end = Math.floor(1000 + Math.random() * 9000);
    return `+1-${area}-${mid}-${end}`;
  }

  // CEO (id=1)
  const ceoFirst = 'Alexandra';
  const ceoLast = 'Chen';
  employees.push({
    id: id++, first_name: ceoFirst, last_name: ceoLast,
    email: makeEmail(ceoFirst, ceoLast), phone: makePhone(),
    hire_date: '2015-03-15', department_id: 1, position_id: 1,
    manager_id: null, office_location_id: 1, status: 'active',
  });

  // CTO (id=2)
  employees.push({
    id: id++, first_name: 'Marcus', last_name: 'Williams',
    email: makeEmail('Marcus', 'Williams'), phone: makePhone(),
    hire_date: '2016-01-10', department_id: 1, position_id: 2,
    manager_id: 1, office_location_id: 1, status: 'active',
  });

  // VPs (id=3,4,5) — Engineering, Product, Sales
  const vpData = [
    { first: 'Sarah', last: 'Johnson', dept: 1, pos: 3, loc: 1, hire: '2016-06-01' },
    { first: 'David', last: 'Kim', dept: 2, pos: 4, loc: 1, hire: '2017-02-15' },
    { first: 'Rachel', last: 'Torres', dept: 4, pos: 5, loc: 2, hire: '2017-09-01' },
  ];
  for (const vp of vpData) {
    employees.push({
      id: id++, first_name: vp.first, last_name: vp.last,
      email: makeEmail(vp.first, vp.last), phone: makePhone(),
      hire_date: vp.hire, department_id: vp.dept, position_id: vp.pos,
      manager_id: vp.dept === 1 ? 2 : 1, office_location_id: vp.loc, status: 'active',
    });
  }

  // Department managers (one per remaining dept that doesn't have a VP)
  const managerPositions: Record<number, number> = {
    3: 14, 5: 19, 6: 21, 7: 23, 8: 24,
  };
  const deptManagers: Record<number, number> = {
    1: 3, 2: 4, 4: 5,  // VPs are managers for these
  };

  for (const [deptId, posId] of Object.entries(managerPositions)) {
    const d = Number(deptId);
    const firstName = pickRandom(firstNames);
    const lastName = pickRandom(lastNames);
    deptManagers[d] = id;
    employees.push({
      id: id++, first_name: firstName, last_name: lastName,
      email: makeEmail(firstName, lastName), phone: makePhone(),
      hire_date: randomDate('2017-01-01', '2019-12-31'),
      department_id: d, position_id: posId,
      manager_id: 1, office_location_id: deptLocations[d], status: 'active',
    });
  }

  // Fill remaining headcount per department
  let nameIdx = 0;
  for (const [deptId, target] of Object.entries(deptHeadcount)) {
    const d = Number(deptId);
    const managerId = deptManagers[d];
    const currentInDept = employees.filter(e => e.department_id === d).length;
    const remaining = target - currentInDept;
    const positions = deptPositions[d];

    for (let i = 0; i < remaining; i++) {
      const firstName = firstNames[nameIdx % firstNames.length];
      const lastName = lastNames[nameIdx % lastNames.length];
      nameIdx++;

      const isTerminated = Math.random() < 0.05;
      employees.push({
        id: id++, first_name: firstName, last_name: lastName,
        email: makeEmail(firstName, lastName), phone: makePhone(),
        hire_date: randomDate('2018-01-01', '2024-06-30'),
        department_id: d,
        position_id: pickRandom(positions),
        manager_id: managerId,
        office_location_id: deptLocations[d],
        status: isTerminated ? 'terminated' : 'active',
      });
    }
  }

  // Insert in batches to avoid param limits
  const batchSize = 50;
  for (let i = 0; i < employees.length; i += batchSize) {
    await knex('employees').insert(employees.slice(i, i + batchSize));
  }
}
