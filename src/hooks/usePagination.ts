import { useState, useMemo } from 'react';

export function usePagination<T>(items: T[], defaultItemsPerPage = 30) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(0, endIndex); // Show all items up to current page
  }, [items, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const hasMoreItems = currentPage * itemsPerPage < items.length;

  const loadMore = () => {
    if (hasMoreItems) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const reset = () => {
    setCurrentPage(1);
  };

  const changeItemsPerPage = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  return {
    paginatedItems,
    currentPage,
    itemsPerPage,
    totalPages,
    hasMoreItems,
    loadMore,
    reset,
    changeItemsPerPage,
    totalItems: items.length,
    currentlyShowing: paginatedItems.length
  };
}