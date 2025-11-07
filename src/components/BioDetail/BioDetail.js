import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Layout from '../Layout/Layout';
import BioViewer from './BioViewer';
import EncyclopediaExcerpt from './EncyclopediaExcerpt';
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
  const [encyclopediaExcerpts, setEncyclopediaExcerpts] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentTab = searchParams.get('tab') || '';

  useEffect(() => {
    const fetchData = async () => {
      const { bios, info } = await loadAllData();

      const foundBio = bios.find(b => String(b.bio_id) === String(bioId));
      setBio(foundBio);

      // Filter for ALL articles with this bio_id
      const bioArticles = info.filter(
        item => String(item.bio_id) === String(bioId) && item.cat === 'entity'
      );
      
      console.log(`Found ${bioArticles.length} articles for bio_id ${bioId}:`, bioArticles.map(a => a.id));
      
      setArticles(bioArticles);

      // Load ALL article JSONs
      const jsonPromises = bioArticles.map(article => {
        console.log('Loading JSON for article:', article.id);
        return loadArticleJson(article.id);
      });
      const jsons = await Promise.all(jsonPromises);
      
      console.log('Loaded JSONs:', jsons.map((j, i) => ({ 
        id: bioArticles[i].id, 
        structure: j ? (j.content ? 'content[]' : j.parts ? 'parts[]' : 'unknown') : 'null'
      })));
      
      setArticleData(jsons);

      // Extract encyclopedia excerpts from ALL sources
      const excerpts = extractEncyclopediaExcerpts(bioArticles, jsons);
      console.log('Final excerpts array:', excerpts);
      setEncyclopediaExcerpts(excerpts);

      setLoading(false);
    };

    fetchData();
  }, [bioId]);

  const extractEncyclopediaExcerpts = (articles, articleJsons) => {
    const excerpts = [];

    console.log(`Extracting excerpts from ${articles.length} articles`);

    for (let idx = 0; idx < articles.length; idx++) {
      const article = articles[idx];
      const json = articleJsons[idx];
      
      console.log(`Processing article ${idx}:`, article.id);
      
      // Skip if no JSON data
      if (!json) {
        console.log(`  -> Skipped: No JSON data for ${article.id}`);
        continue;
      }

      let fullText = '';
      let authors = json.authors || [];

      // Handle content array structure
      if (json.content && Array.isArray(json.content) && json.content.length > 0) {
        fullText = json.content.join(' ');
        console.log(`  -> Using content[] array`);
      }
      // Handle parts array structure
      else if (json.parts && Array.isArray(json.parts) && json.parts.length > 0) {
        const contentParts = json.parts
          .map(part => {
            // Collect authors from parts
            if (part.author && !authors.includes(part.author)) {
              authors.push(part.author);
            }
            return part.content || '';
          })
          .filter(c => c.length > 0);
        
        fullText = contentParts.join(' ');
        console.log(`  -> Using parts[] array with ${json.parts.length} parts`);
      }
      else {
        console.log(`  -> Skipped: No content or parts array for ${article.id}`);
        continue;
      }

      if (!fullText.trim()) {
        console.log(`  -> Skipped: Empty text content for ${article.id}`);
        continue;
      }

      // Extract first 250 words
      const words = fullText.split(/\s+/).filter(w => w.length > 0);
      const excerpt = words.slice(0, 250).join(' ');

      const excerptObj = {
        source: json.source || 'Unknown',
        title: json.title || article.title,
        authors: authors,
        link: json.link || article.link,
        excerpt: excerpt + (words.length > 250 ? '...' : '')
      };

      console.log(`  -> Added excerpt for ${article.id}:`, excerptObj.source);
      excerpts.push(excerptObj);
    }

    console.log(`Extracted ${excerpts.length} total excerpts`);
    return excerpts;
  };

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

        <EncyclopediaExcerpt excerpts={encyclopediaExcerpts} />

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