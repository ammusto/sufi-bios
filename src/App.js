import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import BioDetail from './components/BioDetail/BioDetail';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/bio/:bioId" element={<BioDetail />} />
    </Routes>
  );
}

export default App;