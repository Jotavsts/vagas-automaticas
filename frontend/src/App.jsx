import { useState, useEffect } from 'react'

function App() {
  const [status, setStatus] = useState('')

  useEffect(() => {
    fetch('http://localhost:5000/api/health')
      .then(res => res.json())
      .then(data => setStatus(data.status))
      .catch(err => setStatus('Erro conectando ao backend'))
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4">
        <h1 className="text-3xl font-bold">🚀 Vagas Automáticas</h1>
        <p className="text-gray-400 mt-2">Envie currículos automaticamente para as melhores vagas</p>
      </header>

      <main className="max-w-6xl mx-auto p-8">
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Status do Sistema</h2>
          <p className="text-lg">{status || 'Conectando...'}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">📋 Seus Currículos</h3>
            <p className="text-gray-400">Gerencie seus currículos adaptáveis</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">🔍 Vagas Disponíveis</h3>
            <p className="text-gray-400">Veja as vagas encontradas hoje</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">📊 Histórico</h3>
            <p className="text-gray-400">Acompanhe seus envios</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">⚙️ Configurações</h3>
            <p className="text-gray-400">Personalize suas preferências</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
