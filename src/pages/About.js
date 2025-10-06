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
              from multiple biographical dictionaries and modern encyclopedia entries.
            </p>

            <h3>Sources</h3>
            
            <h4>Ṭabaqāt Works</h4>
            <ul>
              <li>Ḥilyat al-Awliyāʾ</li>
              <li>al-Sulamī's Ṭabaqāt al-Ṣūfiyya</li>
              <li>al-Anṣārī's Ṭabaqāt al-Ṣūfiyya</li>
              <li>al-Khamīs al-Mawṣilī's Manāqib al-Abrār</li>
              <li>al-Aṭṭār's Tadhkirat al-Awliyāʾ</li>
              <li>Jāmī's Nafaḥāt al-Uns</li>
            </ul>

            <h4>Modern Encyclopedias</h4>
            <ul>
              <li>Encyclopaedia of Islam (2nd & 3rd editions)</li>
              <li>Encyclopaedia Iranica</li>
              <li>Dānishnāma-yi Buzurg-i Islāmī</li>
              <li>Türkiye Diyanet Vakfı İslâm Ansiklopedisi</li>
            </ul>

            <h3>How to Use</h3>
            <p>
              Use the search bar to find figures by their Arabic name or transliteration.
              The search automatically normalizes Arabic and Persian characters.
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