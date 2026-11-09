export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  DISPATCHER: 'DISPATCHER',
  STATION_OPERATOR: 'STATION_OPERATOR',
  LOGISTICS_MANAGER: 'LOGISTICS_MANAGER',
  ADMIN: 'ADMIN',
}

export const NAVIGATION_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard Overview',
    path: '/dashboard',
    roles: [
      ROLES.CUSTOMER,
      ROLES.DISPATCHER,
      ROLES.STATION_OPERATOR,
      ROLES.LOGISTICS_MANAGER,
      ROLES.ADMIN,
    ],
  },
  {
    key: 'create-order',
    label: 'Create Delivery Order',
    path: '/orders/create',
    roles: [ROLES.CUSTOMER, ROLES.ADMIN],
  },
  {
    key: 'my-orders',
    label: 'My Delivery Orders',
    path: '/orders',
    roles: [ROLES.CUSTOMER, ROLES.LOGISTICS_MANAGER, ROLES.ADMIN],
  },
  {
    key: 'addresses',
    label: 'Saved Addresses',
    path: '/customer/addresses',
    roles: [ROLES.CUSTOMER],
  },
  {
    key: 'order-approvals',
    label: 'Order Approval Queue',
    path: '/logistics/approvals',
    roles: [ROLES.LOGISTICS_MANAGER, ROLES.ADMIN],
  },
  {
    key: 'fleet-drones',
    label: 'Drone Fleet & Flights',
    path: '/dispatch/drones',
    roles: [ROLES.DISPATCHER, ROLES.LOGISTICS_MANAGER, ROLES.ADMIN],
  },
  {
    key: 'landing-stations',
    label: 'Landing Stations & Slots',
    path: '/stations',
    roles: [ROLES.STATION_OPERATOR, ROLES.DISPATCHER, ROLES.ADMIN],
  },
  {
    key: 'live-tracking',
    label: 'Live Flight Tracking',
    path: '/tracking',
    roles: [
      ROLES.CUSTOMER,
      ROLES.DISPATCHER,
      ROLES.STATION_OPERATOR,
      ROLES.LOGISTICS_MANAGER,
      ROLES.ADMIN,
    ],
  },
  {
    key: 'user-management',
    label: 'Users & Security',
    path: '/admin/users',
    roles: [ROLES.ADMIN],
  },
]

export function getNavigationByRole(role) {
  if (!role) return []
  return NAVIGATION_ITEMS.filter((item) => item.roles.includes(role))
}
