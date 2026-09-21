import React, { useState } from 'react';
import { Nav } from './components/Nav';
import { PredictPage } from './pages/PredictPage';
import { ExplainPage } from './pages/ExplainPage';
import { OptimizePage } from './pages/OptimizePage';
import { SimulatePage } from './pages/SimulatePage';
import { BenchmarkPage } from './pages/BenchmarkPage';

export type Page = 'predict' | 'explain' | 'optimize' | 'simulate' | 'analytics';

function App() {
  const [page, setPage] = useState<Page>('predict');
  return (
    <>
      <Nav page={page} setPage={setPage} />
      <main style={{ flex: 1 }}>
        {page === 'predict' && <PredictPage />}
        {page === 'explain' && <ExplainPage />}
        {page === 'optimize' && <OptimizePage />}
        {page === 'simulate' && <SimulatePage />}
        {page === 'analytics' && <BenchmarkPage />}
      </main>
    </>
  );
}

export default App;
