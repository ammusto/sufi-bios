import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import BioDetail from './components/BioDetail/BioDetail';
import TransmitterView from './pages/TransmitterView';
import TransmitterListView from './pages/TransmitterListView';
import Layout from './components/Layout/Layout';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/bio/:bioId" element={<BioDetail />} />
      <Route path="/transmitters" element={<TransmitterListView />} />
      <Route path="/network" element={<Layout><TransmitterView /></Layout>} />
    </Routes>
  );
}

export default App;