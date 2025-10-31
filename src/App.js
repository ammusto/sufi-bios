import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import BioDetail from './components/BioDetail/BioDetail';
import Network from './pages/Network';
import NetworkSimple from './pages/NetworkSimple';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/bio/:bioId" element={<BioDetail />} />
      <Route path="/network" element={<Network />} />
      <Route path="/network/:source" element={<Network />} />
      <Route path="/network-simple" element={<NetworkSimple />} />

    </Routes>
  );
}

export default App;