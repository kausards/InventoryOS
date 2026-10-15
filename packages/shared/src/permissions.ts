export const PERMISSIONS = {
  ORDERS_VIEW: 'orders.view',
  ORDERS_CREATE: 'orders.create',
  ORDERS_CONFIRM: 'orders.confirm',
  ORDERS_CANCEL: 'orders.cancel',
  ORDERS_HOLD: 'orders.hold',
  ORDERS_EDIT: 'orders.edit',
  ORDERS_EXPORT: 'orders.export',
  ORDERS_BULK_ACTION: 'orders.bulk_action',
  
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_EXPORT: 'inventory.export',
  
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_EDIT: 'products.edit',
  PRODUCTS_DELETE: 'products.delete',
  
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_EDIT: 'customers.edit',
  CUSTOMERS_EXPORT: 'customers.export',
  
  SHIPMENTS_VIEW: 'shipments.view',
  SHIPMENTS_CREATE: 'shipments.create',
  SHIPMENTS_CANCEL: 'shipments.cancel',
  
  RETURNS_VIEW: 'returns.view',
  RETURNS_CREATE: 'returns.create',
  RETURNS_INSPECT: 'returns.inspect',
  
  FINANCE_VIEW: 'finance.view',
  FINANCE_EXPORT: 'finance.export',
  FINANCE_MANAGE: 'finance.manage',
  
  EXPENSES_VIEW: 'expenses.view',
  EXPENSES_CREATE: 'expenses.create',
  
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_INTEGRATIONS: 'settings.integrations',
  SETTINGS_BILLING: 'settings.billing',
  
  TEAM_VIEW: 'team.view',
  TEAM_INVITE: 'team.invite',
  TEAM_REMOVE: 'team.remove',
  TEAM_CHANGE_ROLE: 'team.change_role',
  
  AUDIT_VIEW: 'audit.view',
  
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  
  COURIERS_VIEW: 'couriers.view',
  COURIERS_MANAGE: 'couriers.manage',

  SETTLEMENTS_VIEW: 'settlements.view',
  SETTLEMENTS_MANAGE: 'settlements.manage',

  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_PRINT: 'documents.print',

  RISK_VIEW: 'risk.view',
  RISK_MANAGE: 'risk.manage',
  RISK_OVERRIDE: 'risk.override',

  INTEGRATIONS_VIEW: 'integrations.view',
  INTEGRATIONS_MANAGE: 'integrations.manage',

  NOTIFICATIONS_VIEW: 'notifications.view',
  NOTIFICATIONS_MANAGE: 'notifications.manage',
  NOTIFICATIONS_SEND: 'notifications.send',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
