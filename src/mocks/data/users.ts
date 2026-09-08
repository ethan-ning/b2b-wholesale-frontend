export interface MockUser {
  id: number;
  email: string;
  password: string;
  name: string;
  companyName: string;
  tierId: number;
  tierName: string;
  mustChangePassword: boolean;
}

export const users: MockUser[] = [
  {
    id: 1,
    email: 'dealer1@example.com',
    password: 'password',
    name: 'Alice Johnson',
    companyName: 'Johnson Auto Supply',
    tierId: 1,
    tierName: 'Gold',
    mustChangePassword: false,
  },
  {
    id: 2,
    email: 'dealer2@example.com',
    password: 'password',
    name: 'Bob Chen',
    companyName: 'Chen Parts Co.',
    tierId: 2,
    tierName: 'Silver',
    mustChangePassword: false,
  },
];
