import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { QuickWatch } from './pages/QuickWatch';
import { Timeline } from './pages/Timeline';
import { Movies } from './pages/Movies';
import { Theaters } from './pages/Theaters';
import { Profile } from './pages/Profile';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<QuickWatch />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/theaters" element={<Theaters />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
