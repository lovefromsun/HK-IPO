import { useQuery } from '@tanstack/react-query'
import {
  listAccounts,
  listIpos,
  listRecords,
  listRecordsWithAccount,
  listUserAuditLogs,
  listUsers,
} from '../db'
import { queryKeys } from './keys'

export function useAccountsQuery() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: listAccounts,
  })
}

export function useIposQuery() {
  return useQuery({
    queryKey: queryKeys.ipos,
    queryFn: listIpos,
  })
}

export function useRecordsQuery() {
  return useQuery({
    queryKey: queryKeys.records,
    queryFn: () => listRecords(),
  })
}

export function useRecordsWithAccountQuery() {
  return useQuery({
    queryKey: queryKeys.recordsWithAccounts,
    queryFn: () => listRecordsWithAccount(),
  })
}

export function useUsersQuery() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: listUsers,
  })
}

export function useAuditLogsQuery(limit: number) {
  return useQuery({
    queryKey: queryKeys.auditLogs(limit),
    queryFn: () => listUserAuditLogs(limit),
  })
}
