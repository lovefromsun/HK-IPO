import { QueryClient } from '@tanstack/react-query'

/** 与常见后台类应用一致：短期视为新鲜数据，切换页面先展示缓存再后台刷新 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 90_000,
      gcTime: 15 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})
