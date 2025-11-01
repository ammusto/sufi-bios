import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import BioDetail from './components/BioDetail/BioDetail';
import NetworkContainer from './components/Network/NetworkContainer';
import Layout from './components/Layout/Layout';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/bio/:bioId" element={<BioDetail />} />
      <Route path="/network" element={<Layout><NetworkContainer /></Layout>} />
    </Routes>
  );
}

export default App;