import { useMemo, useState } from 'react'
import { useAccountsQuery, useIposQuery, useRecordsQuery } from '../../query/hooks'
import type { AccountIpoRecord, Ipo } from '../../types'

const makeCellKey = (accountId: number, ipoName: string) => `${accountId}::${ipoName}`
const getIpoSortDate = (ipo: Ipo) => ipo.greyMarketDate || ipo.listDate || ipo.createdAt || ''
const IPO_PAGE_SIZE = 12

export function AllotmentMatrixPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<'all' | number>('all')
  const [selectedIpoName, setSelectedIpoName] = useState('all')
  const [onlyShowHitCells, setOnlyShowHitCells] = useState(false)
  const [onlyShowUnsoldHits, setOnlyShowUnsoldHits] = useState(false)
  const [hideNoHitAccounts, setHideNoHitAccounts] = useState(false)
  const [ipoPage, setIpoPage] = useState(0)
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null)

  const { data: accounts = [], isPending: accountsPending } = useAccountsQuery()
  const { data: ipos = [], isPending: iposPending } = useIposQuery()
  const { data: records = [], isPending: recordsPending } = useRecordsQuery()
  const coreLoading = accountsPending || iposPending || recordsPending
  const filterMode = onlyShowUnsoldHits ? 'unsold' : onlyShowHitCells ? 'hit' : 'all'

  const filteredAccounts = useMemo(() => {
    if (selectedAccountId === 'all') return accounts
    return accounts.filter((account) => account.id === selectedAccountId)
  }, [accounts, selectedAccountId])

  const filteredIpos = useMemo(() => {
    const baseIpos: Ipo[] = ipos.length
      ? ipos
      : Array.from(
          new Map(records.map((item) => [item.ipoNameSnapshot, item.ipoNameSnapshot])).keys(),
        ).map((ipoName) => ({
          ipoName,
          createdAt: '',
          updatedAt: '',
        }))

    return baseIpos
      .filter((ipo) => {
        const byName = selectedIpoName === 'all' || ipo.ipoName === selectedIpoName
        return byName
      })
      .sort((a, b) => getIpoSortDate(b).localeCompare(getIpoSortDate(a)))
  }, [ipos, selectedIpoName, records])

  const recordMap = useMemo(() => {
    const map = new Map<string, AccountIpoRecord>()
    records.forEach((record) => {
      const key = makeCellKey(record.accountId, record.ipoNameSnapshot)
      const prev = map.get(key)
      if (!prev || record.updatedAt > prev.updatedAt) {
        map.set(key, record)
      }
    })
    return map
  }, [records])

  const accountStats = useMemo(() => {
    const map = new Map<number, { hitCount: number }>()
    filteredAccounts.forEach((account) => {
      const accountId = account.id ?? 0
      let hitCount = 0
      filteredIpos.forEach((ipo) => {
        const record = recordMap.get(makeCellKey(accountId, ipo.ipoName))
        const isMatched =
          filterMode === 'unsold'
            ? Boolean(record?.isAllotted && !record.isSold)
            : filterMode === 'hit'
              ? Boolean(record?.isAllotted)
              : true
        if (record?.isAllotted && isMatched) {
          hitCount += 1
        }
      })
      map.set(accountId, { hitCount })
    })
    return map
  }, [filteredAccounts, filteredIpos, recordMap, filterMode])

  const visibleAccounts = useMemo(() => {
    if (!hideNoHitAccounts) return filteredAccounts
    return filteredAccounts.filter((account) => {
      const stats = accountStats.get(account.id ?? 0)
      return (stats?.hitCount ?? 0) > 0
    })
  }, [filteredAccounts, hideNoHitAccounts, accountStats])

  const ipoColumnStats = useMemo(() => {
    return filteredIpos.map((ipo) => {
      let hitCount = 0
      visibleAccounts.forEach((account) => {
        const record = recordMap.get(makeCellKey(account.id ?? 0, ipo.ipoName))
        const isMatched =
          filterMode === 'unsold'
            ? Boolean(record?.isAllotted && !record.isSold)
            : filterMode === 'hit'
              ? Boolean(record?.isAllotted)
              : true
        if (record?.isAllotted && isMatched) {
          hitCount += 1
        }
      })
      return { ipoName: ipo.ipoName, hitCount }
    })
  }, [filteredIpos, visibleAccounts, recordMap, filterMode])

  const totalPages = Math.max(1, Math.ceil(filteredIpos.length / IPO_PAGE_SIZE))
  const currentPage = Math.min(Math.max(0, ipoPage), totalPages - 1)
  const visibleIpos = filteredIpos.slice(
    currentPage * IPO_PAGE_SIZE,
    (currentPage + 1) * IPO_PAGE_SIZE,
  )
  const visibleIpoStats = ipoColumnStats.slice(
    currentPage * IPO_PAGE_SIZE,
    (currentPage + 1) * IPO_PAGE_SIZE,
  )

  const selectedCell = useMemo(() => {
    if (!selectedCellKey) return null
    const [accountIdText, ipoName] = selectedCellKey.split('::')
    const accountId = Number(accountIdText)
    const account = accounts.find((item) => item.id === accountId)
    const ipo = filteredIpos.find((item) => item.ipoName === ipoName)
    if (!account || !ipo) return null
    const record = recordMap.get(makeCellKey(accountId, ipoName))
    return { account, ipo, record }
  }, [selectedCellKey, accounts, filteredIpos, recordMap])

  const shouldDisplayCell = (record?: AccountIpoRecord) => {
    const isMatched =
      filterMode === 'unsold'
        ? Boolean(record?.isAllotted && !record.isSold)
        : filterMode === 'hit'
          ? Boolean(record?.isAllotted)
          : true
    if (!isMatched) return false
    if (!record?.isAllotted) return !onlyShowHitCells && !onlyShowUnsoldHits
    return true
  }

  const getCellText = (record?: AccountIpoRecord) => {
    if (!record?.isAllotted) return '未中'
    return `中${record.allottedQty}${record.isSold ? '（已卖）' : ''}`
  }

  const getCellClassName = (record?: AccountIpoRecord) => {
    if (!record?.isAllotted) return 'matrix-cell miss compact'
    if (!record.isSold) return 'matrix-cell hit compact'
    return 'matrix-cell sold compact'
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h2>中签总览</h2>
          <p>按“账号 x 新股”矩阵直观看到每个账号中签与卖出状态</p>
        </div>
      </header>

      {coreLoading ? <p className="data-hint">正在加载矩阵数据（若已访问过其他页，会先显示缓存）…</p> : null}

      <div className="matrix-legend">
        <span className="legend-item hit">中签</span>
        <span className="legend-item sold">中签已卖</span>
        <span className="legend-item miss">未中</span>
      </div>

      <div className="filter-row matrix-filter-row">
        <label>
          账号筛选：
          <select
            value={selectedAccountId}
            onChange={(event) =>
              setSelectedAccountId(
                event.target.value === 'all' ? 'all' : Number(event.target.value),
              )
            }
          >
            <option value="all">全部账号</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.accountNo} - {account.ownerName}
              </option>
            ))}
          </select>
        </label>

        <label>
          新股筛选：
          <select
            value={selectedIpoName}
            onChange={(event) => setSelectedIpoName(event.target.value)}
          >
            <option value="all">全部新股</option>
            {ipos.map((ipo) => (
              <option key={ipo.id ?? ipo.ipoName} value={ipo.ipoName}>
                {ipo.ipoName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="matrix-switches">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={onlyShowHitCells}
            onChange={(event) => {
              const checked = event.target.checked
              setOnlyShowHitCells(checked)
              if (checked) setOnlyShowUnsoldHits(false)
            }}
          />
          仅显示中签格
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={onlyShowUnsoldHits}
            onChange={(event) => {
              const checked = event.target.checked
              setOnlyShowUnsoldHits(checked)
              if (checked) setOnlyShowHitCells(false)
            }}
          />
          仅显示未卖中签格
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={hideNoHitAccounts}
            onChange={(event) => setHideNoHitAccounts(event.target.checked)}
          />
          隐藏全未中账号
        </label>
      </div>

      <div className="matrix-pagination">
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setIpoPage((prev) => Math.max(0, prev - 1))}
          disabled={currentPage === 0}
        >
          上一组
        </button>
        <span>
          新股列第 {currentPage * IPO_PAGE_SIZE + 1} -{' '}
          {Math.min((currentPage + 1) * IPO_PAGE_SIZE, filteredIpos.length)} 列 / 共{' '}
          {filteredIpos.length} 列
        </span>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setIpoPage((prev) => Math.min(totalPages - 1, prev + 1))}
          disabled={currentPage >= totalPages - 1}
        >
          下一组
        </button>
      </div>

      <div className="matrix-wrap">
        <table className="matrix-table">
          <thead>
            <tr>
              <th className="sticky-col">账号</th>
              {visibleIpos.length ? (
                visibleIpos.map((ipo) => (
                  <th key={ipo.ipoName}>
                    <div className="ipo-head-cell">
                      <span>{ipo.ipoName}</span>
                      {ipo.stockCode ? <small>{ipo.stockCode}</small> : null}
                    </div>
                  </th>
                ))
              ) : (
                <th>暂无新股</th>
              )}
              <th className="summary-col">中签次数</th>
            </tr>
          </thead>
          <tbody>
            {visibleAccounts.length ? (
              visibleAccounts.map((account) => (
                <tr key={account.id}>
                  <th className="sticky-col account-col">
                    {account.accountNo} - {account.ownerName}
                  </th>
                  {visibleIpos.length ? (
                    visibleIpos.map((ipo) => {
                      const record = recordMap.get(makeCellKey(account.id ?? 0, ipo.ipoName))
                      const show = shouldDisplayCell(record)
                      return (
                        <td
                          key={`${account.id}-${ipo.ipoName}`}
                          className={show ? getCellClassName(record) : 'matrix-cell hidden-cell'}
                          onClick={() => setSelectedCellKey(makeCellKey(account.id ?? 0, ipo.ipoName))}
                        >
                          {show ? getCellText(record) : ''}
                        </td>
                      )
                    })
                  ) : (
                    <td className="empty-cell">暂无数据</td>
                  )}
                  <td className="summary-col">{accountStats.get(account.id ?? 0)?.hitCount ?? 0}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Math.max(visibleIpos.length + 2, 2)} className="empty-cell">
                  未找到符合筛选条件的账号
                </td>
              </tr>
            )}
          </tbody>
          {visibleIpos.length ? (
            <tfoot>
              <tr>
                <th className="sticky-col account-col">该列汇总</th>
                {visibleIpoStats.map((item) => (
                  <th key={`sum-${item.ipoName}`}>中签{item.hitCount}</th>
                ))}
                <th className="summary-col">-</th>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {selectedCell ? (
        <section className="matrix-detail">
          <h3>单元格详情</h3>
          <p>
            账号：{selectedCell.account.accountNo} - {selectedCell.account.ownerName}
          </p>
          <p>
            新股：{selectedCell.ipo.ipoName}
            {selectedCell.ipo.stockCode ? ` (${selectedCell.ipo.stockCode})` : ''}
          </p>
          <p>
            状态：
            {selectedCell.record?.isAllotted
              ? `中签 ${selectedCell.record.allottedQty}，${
                  selectedCell.record.isSold ? '已卖出' : '未卖出'
                }`
              : '未中签'}
          </p>
          <div className="form-actions">
            <button type="button" className="secondary-btn" onClick={() => setSelectedCellKey(null)}>
              关闭详情
            </button>
          </div>
        </section>
      ) : null}
    </section>
  )
}
