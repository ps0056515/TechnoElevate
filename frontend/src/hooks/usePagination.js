import { useState, useMemo } from 'react';

export default function usePagination(data, pageSize = 10) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil((data?.length || 0) / pageSize));

  // Reset to page 1 if data shrinks and current page is out of range
  const safePage = Math.min(page, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return (data || []).slice(start, start + pageSize);
  }, [data, safePage, pageSize]);

  return {
    page: safePage,
    setPage,
    totalPages,
    paginatedData,
    total: data?.length || 0,
    pageSize,
  };
}
