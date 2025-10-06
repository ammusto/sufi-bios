import React from 'react';

const Footer = () => {
  return (
    <footer>
      <div className="div-footer">
        <div className="footer-link-container">
          <a href="mailto:your-email@example.com">Contact</a>
          <a href="https://github.com/yourusername/sufi-bios">
            GitHub
          </a>
        </div>
        <div>
          © Your Name {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
};

export default Footer;