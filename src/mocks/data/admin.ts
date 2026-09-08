import type { CustomerTier, Warehouse, Customer } from '../../api/types';

export interface MockAdmin {
  id: number;
  email: string;
  password: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
}

export const admins: MockAdmin[] = [
  { id: 1, email: 'admin@example.com', password: 'admin123', name: 'System Admin', role: 'SUPER_ADMIN' },
];

export const tiers: CustomerTier[] = [
  { id: 1, name: 'Gold', sortOrder: 1 },
  { id: 2, name: 'Silver', sortOrder: 2 },
];

export const warehouses: Warehouse[] = [
  { id: 1, name: 'Main Warehouse', code: 'WH-MAIN', active: true },
  { id: 2, name: 'East Coast', code: 'WH-EC', active: true },
];

export const customers: Customer[] = [
  {
    id: 1,
    email: 'dealer1@example.com',
    name: 'Alice Johnson',
    companyName: 'Johnson Auto Supply',
    tierId: 1,
    tierName: 'Gold',
    phone: '555-1001',
    status: 'ACTIVE',
    mustChangePassword: false,
    createdAt: '2025-01-15T08:00:00Z',
  },
  {
    id: 2,
    email: 'dealer2@example.com',
    name: 'Bob Chen',
    companyName: 'Chen Parts Co.',
    tierId: 2,
    tierName: 'Silver',
    phone: '555-2002',
    status: 'ACTIVE',
    mustChangePassword: false,
    createdAt: '2025-02-20T10:30:00Z',
  },
];

// Mutable state for admin CRUD operations
export let mutableCustomers = [...customers];
export function setMutableCustomers(next: Customer[]) {
  mutableCustomers = next;
}

export function makeAdminJwt(admin: MockAdmin): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: admin.email,
    adminId: admin.id,
    role: admin.role,
    exp: Math.floor(Date.now() / 1000) + 86400,
  }));
  return `${header}.${payload}.admin-mock-signature`;
}
