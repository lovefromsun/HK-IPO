interface StatsPanelProps {
  totalAccounts: number
  totalParticipations: number
  allottedCount: number
  allottedRate: string
}

const metricItems = (props: StatsPanelProps) => [
  { label: '账号总数', value: props.totalAccounts.toString() },
  { label: '参与次数', value: props.totalParticipations.toString() },
  { label: '中签次数', value: props.allottedCount.toString() },
  { label: '中签率', value: props.allottedRate },
]

export function StatsPanel(props: StatsPanelProps) {
  return (
    <section className="metrics-grid">
      {metricItems(props).map((item) => (
        <div className="metric-card" key={item.label}>
          <p>{item.label}</p>
          <strong>{item.value}</strong>
        </div>
      ))}
    </section>
  )
}
