import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Header = () => {
  const location = useLocation();

  return (
    <header>
      <div className="header-container">
        {!location.pathname.startsWith('/bio/') && (
          <div className="header-text"><a href="/">sufi-bios</a></div>
        )}
        <nav>
          <ul className="flex">
            <li><Link to="/">Browse Bios</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/network">Network</Link></li>
            <li><Link to="/network-simple">Network</Link></li>

          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;