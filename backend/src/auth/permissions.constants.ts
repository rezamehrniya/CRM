export const PERMISSION_KEYS = [
  'meta.read',
  'dashboard.read',
  'timeline.read',

  'sms.read',
  'sms.write',
  'sms.team.read',
  'sms.bulk.send',
  'sms.manage',

  'calls.read',
  'calls.team.read',
  'calls.manage',

  'todos.read',
  'todos.write',
  'todos.manage',

  'contacts.read',
  'contacts.write',
  'contacts.manage',

  'companies.read',
  'companies.write',
  'companies.manage',

  'leads.read',
  'leads.write',
  'leads.manage',

  'tasks.read',
  'tasks.write',
  'tasks.manage',

  'activities.read',
  'activities.write',
  'activities.manage',

  'quotes.read',
  'quotes.write',
  'quotes.manage',

  'invoices.read',
  'invoices.write',
  'invoices.manage',

  'products.read',
  'products.write',
  'products.manage',

  'imports.read',
  'imports.write',
  'imports.manage',

  'users.read',
  'users.write',
  'users.manage',

  'settings.read',
  'settings.write',
  'settings.manage',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type DefaultRoleDefinition = {
  key: 'ADMIN' | 'SALES_MANAGER' | 'SALES_REP' | 'VIEWER';
  name: string;
  description: string;
  permissions: readonly PermissionKey[];
};

export type DefaultRoleKey = DefaultRoleDefinition['key'];

const SALES_DOMAIN_PERMISSIONS = [
  'timeline.read',
  'sms.read',
  'sms.write',
  'sms.team.read',
  'sms.bulk.send',
  'sms.manage',
  'calls.read',
  'calls.team.read',
  'calls.manage',
  'todos.read',
  'todos.write',
  'todos.manage',
  'contacts.read',
  'contacts.write',
  'contacts.manage',
  'companies.read',
  'companies.write',
  'companies.manage',
  'leads.read',
  'leads.write',
  'leads.manage',
  'tasks.read',
  'tasks.write',
  'tasks.manage',
  'activities.read',
  'activities.write',
  'activities.manage',
  'quotes.read',
  'quotes.write',
  'quotes.manage',
  'invoices.read',
  'invoices.write',
  'invoices.manage',
  'products.read',
  'products.write',
  'products.manage',
  'imports.read',
  'imports.write',
  'imports.manage',
] as const satisfies readonly PermissionKey[];

export const DEFAULT_ROLE_DEFINITIONS: readonly DefaultRoleDefinition[] = [
  {
    key: 'ADMIN',
    name: 'Admin',
    description: 'Full tenant access',
    permissions: PERMISSION_KEYS,
  },
  {
    key: 'SALES_MANAGER',
    name: 'Sales Manager',
    description: 'Manage all sales operations without sensitive settings changes',
    permissions: [
      'meta.read',
      'dashboard.read',
      ...SALES_DOMAIN_PERMISSIONS,
      'users.read',
      'settings.read',
    ],
  },
  {
    key: 'SALES_REP',
    name: 'Sales Rep',
    description: 'Read/write daily sales operations without manage actions',
    permissions: [
      'meta.read',
      'dashboard.read',
      'timeline.read',
      'sms.read',
      'sms.write',
      'calls.read',
      'todos.read',
      'todos.write',
      'todos.manage',
      'contacts.read',
      'contacts.write',
      'companies.read',
      'companies.write',
      'leads.read',
      'leads.write',
      'tasks.read',
      'tasks.write',
      'activities.read',
      'activities.write',
      'quotes.read',
      'quotes.write',
      'invoices.read',
      'invoices.write',
      'products.read',
      'imports.read',
    ],
  },
  {
    key: 'VIEWER',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      'meta.read',
      'dashboard.read',
      'timeline.read',
      'contacts.read',
      'companies.read',
      'leads.read',
      'tasks.read',
      'activities.read',
      'quotes.read',
      'invoices.read',
      'products.read',
      'imports.read',
      'users.read',
      'settings.read',
    ],
  },
];

const KNOWN_ROLE_KEYS = new Set<string>(DEFAULT_ROLE_DEFINITIONS.map((role) => role.key));
const ROLE_DEFINITION_BY_KEY = new Map<DefaultRoleKey, DefaultRoleDefinition>(
  DEFAULT_ROLE_DEFINITIONS.map((role) => [role.key, role] as const),
);

export function normalizeRoleKey(raw?: string | null): DefaultRoleDefinition['key'] {
  const value = String(raw ?? '')
    .trim()
    .toUpperCase();

  if (value === 'OWNER') return 'ADMIN';
  if (value === 'MEMBER') return 'SALES_REP';
  if (value === 'SALESREP') return 'SALES_REP';
  if (value === 'SALESMANAGER') return 'SALES_MANAGER';
  if (KNOWN_ROLE_KEYS.has(value)) {
    return value as DefaultRoleDefinition['key'];
  }
  return 'SALES_REP';
}

export function getDefaultRoleDefinition(raw?: string | null): DefaultRoleDefinition {
  const key = normalizeRoleKey(raw);
  return ROLE_DEFINITION_BY_KEY.get(key) ?? ROLE_DEFINITION_BY_KEY.get('SALES_REP')!;
}

export function getDefaultPermissionsForRole(raw?: string | null): PermissionKey[] {
  return [...getDefaultRoleDefinition(raw).permissions];
}
