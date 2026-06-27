import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { ApplicantDashboard } from './pages/ApplicantDashboard'
import { ApplicationDetail } from './pages/ApplicationDetail'
import { ApplicationForm } from './pages/ApplicationForm'
import { LoginPage } from './pages/LoginPage'
import { ReviewerQueue } from './pages/ReviewerQueue'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<ApplicantDashboard />} />
              <Route path="applications/new" element={<ApplicationForm />} />
              <Route path="applications/:id" element={<ApplicationDetail />} />
              <Route path="review" element={<ReviewerQueue />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
