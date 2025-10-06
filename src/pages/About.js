import React from 'react';
import Layout from '../components/Layout/Layout';

const About = () => {
  return (
    <Layout>
      <div className="container">
        <div className="about-container">
          <div className="text-content">
            <h2>About Sufi Biographies</h2>
            
            <p>
              This database provides access to biographical information about Sufi figures
              from multiple tabaqat (biographical dictionary) sources and modern encyclopedia entries.
            </p>

            <h3>Features</h3>
            <ul>
              <li>Browse biographies with Arabic names and transliterations</li>
              <li>Search with automatic Arabic/Persian character normalization</li>
              <li>View original tabaqat pages from six classical sources</li>
              <li>Access modern encyclopedia articles about each figure</li>
              <li>Combined bibliographies from multiple sources</li>
            </ul>

            <h3>Sources</h3>
            
            <h4>Tabaqat Works</h4>
            <ul>
              <li>Hilya al-Awliya</li>
              <li>Sulami's Tabaqat al-Sufiyya</li>
              <li>Ansari's Tabaqat al-Sufiyya</li>
              <li>Manaqib</li>
              <li>Attar's Tadhkirat al-Awliya</li>
              <li>Jami's Nafahat al-Uns</li>
            </ul>

            <h4>Modern Encyclopedias</h4>
            <ul>
              <li>Encyclopaedia of Islam (2nd & 3rd editions)</li>
              <li>Encyclopaedia Iranica</li>
              <li>Dānešnāma-ye Bozorg-e Eslāmī</li>
              <li>Türkiye Diyanet Vakfı İslâm Ansiklopedisi</li>
            </ul>

            <h3>How to Use</h3>
            <p>
              Use the search bar to find figures by their Arabic name or transliteration.
              The search automatically normalizes Arabic and Persian characters, so you don't
              need to worry about different forms of alif, ya, kaf, etc.
            </p>
            <p>
              Entries marked with a star have additional encyclopedia articles available.
              Click on any entry to view the full biographical information and navigate
              through the original tabaqat pages.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default About;