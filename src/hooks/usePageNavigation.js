import { useState, useCallback } from 'react';

export const usePageNavigation = (initialPages) => {
  const [currentPages, setCurrentPages] = useState(initialPages);

  const goToPage = useCallback((source, page) => {
    setCurrentPages(prev => ({
      ...prev,
      [source]: page
    }));
  }, []);

  const nextPage = useCallback((source) => {
    setCurrentPages(prev => ({
      ...prev,
      [source]: prev[source] + 1
    }));
  }, []);

  const prevPage = useCallback((source) => {
    setCurrentPages(prev => ({
      ...prev,
      [source]: prev[source] - 1
    }));
  }, []);

  return { currentPages, goToPage, nextPage, prevPage };
};