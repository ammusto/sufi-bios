import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import BioList from '../components/BioList/BioList';
import { loadAllData } from '../utils/dataLoader';
import Loading from '../components/common/Loading';

const Home = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const page = parseInt(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';

  useEffect(() => {
    loadAllData()
      .then(setData)
      .catch(err => {
        console.error('Error loading data:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSearchChange = (newSearch) => {
    const params = new URLSearchParams(searchParams);
    if (newSearch) {
      params.set('search', newSearch);
      params.set('page', '1');
    } else {
      params.delete('search');
    }
    setSearchParams(params);
  };

  const handlePageChange = (newPage) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

  if (loading) return <Layout><Loading /></Layout>;
  if (error) return <Layout><div className="error">Error: {error}</div></Layout>;
  if (!data) return <Layout><div className="error">No data available</div></Layout>;

  return (
    <Layout>
      <BioList 
        data={data}
        currentPage={page}
        searchTerm={search}
        onSearchChange={handleSearchChange}
        onPageChange={handlePageChange}
      />
    </Layout>
  );
};

export default Home;