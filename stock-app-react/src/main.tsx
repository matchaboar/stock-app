import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Import the generated route tree
import { routeTree } from './routeTree.gen'
import { ENV } from './config/env'

import './styles.css'
import reportWebVitals from './reportWebVitals.ts'
import type { RouterContext } from './lib/routerContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: ENV.cacheMaxAgeMs,
      gcTime: ENV.cacheMaxAgeMs,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const storage =
  typeof window !== 'undefined'
    ? window.localStorage
    : {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      }

const persister = createSyncStoragePersister({
  storage,
  key: 'stock-app-query-cache',
})

let queryClientReady: Promise<void>

if (typeof window !== 'undefined') {
  const [unsubscribePersist, restorePromise] = persistQueryClient({
    queryClient,
    persister,
    maxAge: ENV.cacheMaxAgeMs,
  })

  queryClientReady = restorePromise
    .then(() => undefined)
    .catch((error) => {
      console.warn('[AlphaVantage] Failed to restore persisted cache, clearing it.', error)
      return persister.removeClient?.()
    })

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      unsubscribePersist()
    })
  }
} else {
  queryClientReady = Promise.resolve()
}

// Create a new router instance
const router = createRouter({
  routeTree,
  context: {
    queryClient,
    queryClientReady,
  } satisfies RouterContext,
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.getElementById('app')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <ReactQueryDevtools buttonPosition="bottom-left" />
      </QueryClientProvider>
    </StrictMode>,
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
