import { useEffect, useState } from 'react'
import { fetchApiHealthCheck } from './apiClient'

function App() {
  const [healthCheckResponseValue, setHealthCheckResponseValue] = useState<string>('(not requested yet)')

  useEffect(() => {
    fetchApiHealthCheck()
      .then((json) => setHealthCheckResponseValue(JSON.stringify(json)))
      .catch((error) => setHealthCheckResponseValue(`request failed: ${String(error)}`))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="p-6 border-b bg-white">
        <h1 className="text-2xl font-bold">Multi-Tenant Admin — Frontend Health</h1>
        <p className="text-sm text-gray-600">This page verifies connectivity to the API server.</p>
      </header>
      <main className="p-6">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-2 font-semibold">API Health Check Response</div>
          <pre className="whitespace-pre-wrap text-sm">{healthCheckResponseValue}</pre>
        </div>
      </main>
    </div>
  )
}

export default App
