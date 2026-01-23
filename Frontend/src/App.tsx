import AppRoutes from './routes/AppRoutes'
import { UserProvider } from './contexts/userContext'
import ErrorBoundary from './components/ErrorBoundary'
import { ReduxProvider } from './app/providers'

export default function App() {
  return (
    <ErrorBoundary>
      <ReduxProvider>
        <UserProvider>
          <AppRoutes />
        </UserProvider>
      </ReduxProvider>
    </ErrorBoundary>
  )
}
