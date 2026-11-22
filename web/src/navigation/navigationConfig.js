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
    label: 'Tổng Quan Hệ Thống',
    path: '/dashboard',
    roles: [ROLES.ADMIN, ROLES.LOGISTICS_MANAGER],
  },
  {
    key: 'admin-products',
    label: 'Quản Lý Sản Phẩm',
    path: '/admin/products',
    roles: [ROLES.ADMIN],
  },
  {
    key: 'fleet-drones',
    label: 'Quản Lý Đơn Hàng & Drone',
    path: '/dispatch/drones',
    roles: [ROLES.ADMIN, ROLES.DISPATCHER, ROLES.LOGISTICS_MANAGER],
  },
  {
    key: 'live-tracking',
    label: 'Theo Dõi Giao Hàng Drone',
    path: '/tracking',
    roles: [
      ROLES.ADMIN,
      ROLES.DISPATCHER,
      ROLES.STATION_OPERATOR,
      ROLES.LOGISTICS_MANAGER,
      ROLES.CUSTOMER,
    ],
  },
  {
    key: 'user-management',
    label: 'Quản Lý Tài Khoản',
    path: '/admin/users',
    roles: [ROLES.ADMIN],
  },
  {
    key: 'customer-feedbacks',
    label: 'Feedback Khách Hàng',
    path: '/admin/feedbacks',
    roles: [ROLES.ADMIN],
  },
  {
    key: 'my-orders',
    label: 'Đơn Hàng Của Tôi',
    path: '/orders',
    roles: [ROLES.CUSTOMER],
  },
  {
    key: 'create-order',
    label: 'Đặt Giao Hàng Drone',
    path: '/orders/create',
    roles: [ROLES.CUSTOMER],
  },
  {
    key: 'addresses',
    label: 'Sổ Địa Chỉ Nhận Hàng',
    path: '/customer/addresses',
    roles: [ROLES.CUSTOMER],
  },
]

export function getNavigationByRole(role) {
  if (!role) return []
  return NAVIGATION_ITEMS.filter((item) => item.roles.includes(role))
}
