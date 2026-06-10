import React, { useState } from 'react';
import { Nav } from './components/Nav';
import { PredictPage } from './pages/PredictPage';
import { BenchmarkPage } from './pages/BenchmarkPage';
import { SimulatePage } from './pages/SimulatePage';

type Page = 'predict' | 'benchmark' | 'simulate';

function App() {
  const [page, setPage] = useState<Page>('predict');
  return (
    <>
      <Nav page={page} setPage={setPage} />
      <main style={{ flex: 1 }}>
        {page === 'predict'   && <PredictPage />}
        {page === 'benchmark' && <BenchmarkPage />}
        {page === 'simulate'  && <SimulatePage />}
      </main>
    </>
  );
}

export default App;
