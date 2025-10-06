import React from 'react';
import Header from './Header';
import Footer from './Footer';
import './Layout.css';
import { useLocation } from 'react-router-dom';

const Layout = ({ children }) => {
  const location = useLocation();

  return (
    <>
      <Header />
      <main>{children}</main>
      {!location.pathname.startsWith('/bio/') && <Footer />}
    </>
  );
};

export default Layout;