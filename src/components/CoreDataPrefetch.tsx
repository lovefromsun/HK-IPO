import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '../auth/useAuth'
import { listAccounts, listIpos, listRecords, listRecordsWithAccount } from '../db'
import { queryKeys } from '../query/keys'

/** 登录后预取列表，点击进入各页时多数情况下已有缓存 */
export function CoreDataPrefetch() {
  const { user } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user) return
    void qc.prefetchQuery({ queryKey: queryKeys.accounts, queryFn: listAccounts })
    void qc.prefetchQuery({ queryKey: queryKeys.ipos, queryFn: listIpos })
    void qc.prefetchQuery({ queryKey: queryKeys.records, queryFn: () => listRecords() })
    void qc.prefetchQuery({
      queryKey: queryKeys.recordsWithAccounts,
      queryFn: () => listRecordsWithAccount(),
    })
  }, [qc, user?.id])

  return null
}
