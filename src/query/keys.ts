export const queryKeys = {
  accounts: ['hk-ipo', 'accounts'] as const,
  ipos: ['hk-ipo', 'ipos'] as const,
  records: ['hk-ipo', 'records'] as const,
  recordsWithAccounts: ['hk-ipo', 'records', 'with-accounts'] as const,
  users: ['hk-ipo', 'users'] as const,
  auditLogs: (limit: number) => ['hk-ipo', 'audit-logs', limit] as const,
}
