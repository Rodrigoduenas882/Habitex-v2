/**
 * Purely visual mock values for /ui-preview. Never imported outside this
 * route, and never wired into domain types, stores, repositories or APIs.
 */
export const uiPreviewMockData = {
  activeRentalsCount: 4,
  receivedThisMonth: '$3.850.000',
  pendingAmount: '$950.000',
  pendingPaymentAmount: '$950.000',
  userEmail: 'demo@habitex.app',
} as const
