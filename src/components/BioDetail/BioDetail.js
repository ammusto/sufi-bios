import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Layout from '../Layout/Layout';
import BioViewer from './BioViewer';
import ArticlesSection from './ArticlesSection';
import BibliographySection from './BibliographySection';
import GeographySection from './GeographySection';
import TransmissionNetworkSection from './TransmissionNetworkSection';
import { loadAllData, loadArticleJson } from '../../utils/dataLoader';
import Loading from '../common/Loading';

const BioDetail = () => {
  const { bioId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bio, setBio] = useState(null);
  const [articles, setArticles] = useState([]);
  const [articleData, setArticleData] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentTab = searchParams.get('tab') || '';

  useEffect(() => {
    const fetchData = async () => {
      const { bios, info } = await loadAllData();

      const foundBio = bios.find(b => String(b.bio_id) === String(bioId));
      setBio(foundBio);

      const bioArticles = info.filter(
        item => String(item.bio_id) === String(bioId) && item.cat === 'entity'
      );
      setArticles(bioArticles);

      const jsonPromises = bioArticles.map(article =>
        loadArticleJson(article.id)
      );
      const jsons = await Promise.all(jsonPromises);
      setArticleData(jsons);

      setLoading(false);
    };

    fetchData();
  }, [bioId]);

  const handleTabChange = (tab) => {
    const params = new URLSearchParams(searchParams);
    if (tab) {
      params.set('tab', tab);
    } else {
      params.delete('tab');
    }
    setSearchParams(params);
  };

  if (loading) return <Layout><Loading /></Layout>;
  if (!bio) return <Layout><div>Biography not found</div></Layout>;

  return (
    <Layout>
      <div className="container">
        <div className="header">
          <h1>{bio.name_ar || bio.name_lat}</h1>
          {bio.name_ar && bio.name_lat && (
            <p style={{ fontSize: '18px', color: '#666' }}>{bio.name_lat}</p>
          )}
        </div>

        <BioViewer
          bio={bio}
          currentTab={currentTab}
          onTabChange={handleTabChange}
        />

        <GeographySection 
          bioId={bioId}
          bioName={bio.name_ar || bio.name_lat}
        />

        {articles.length > 0 && (
          <>
            <ArticlesSection articles={articles} articleData={articleData} />
            <BibliographySection articleData={articleData} />
          </>
        )}

        <TransmissionNetworkSection 
          bioId={bioId}
          bioName={bio.name_ar || bio.name_lat}
        />
      </div>
    </Layout>
  );
};

export default BioDetail;