import React from 'react';

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  isSubmitting,
  maxPagesToShow = 5,
}) {
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  const pages = [];
  // Ensure currentPage is within valid range for calculation
  const currentValidPage = Math.max(1, Math.min(currentPage, totalPages));

  let startPage = Math.max(1, currentValidPage - Math.floor(maxPagesToShow / 2));
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

  if (endPage - startPage + 1 < maxPagesToShow) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(
      <button
        key={i}
        onClick={() => handlePageChange(i)}
        className={`px-4 py-2 mx-1 rounded-lg text-sm font-medium transition-all duration-200 ${
          currentValidPage === i
            ? 'bg-[var(--primary)] text-white'
            : 'bg-gray-200 text-[var(--text-primary)] hover:bg-gray-300'
        }`}
        disabled={isSubmitting}
      >
        {i}
      </button>
    );
  }

  return (
    <div className="flex justify-center items-center mt-6">
      <button
        onClick={() => handlePageChange(currentValidPage - 1)}
        className="px-4 py-2 mx-1 rounded-lg bg-gray-200 text-[var(--text-primary)] hover:bg-gray-300 text-sm font-medium transition-all duration-200"
        disabled={currentValidPage === 1 || isSubmitting}
      >
        Trước
      </button>
      {startPage > 1 && (
        <>
          <button
            onClick={() => handlePageChange(1)}
            className="px-4 py-2 mx-1 rounded-lg bg-gray-200 text-[var(--text-primary)] hover:bg-gray-300 text-sm font-medium transition-all duration-200"
            disabled={isSubmitting}
          >
            1
          </button>
          {startPage > 2 && <span className="px-2 text-sm text-[var(--text-secondary)]">...</span>}
        </>
      )}
      {pages}
      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="px-2 text-sm text-[var(--text-secondary)]">...</span>}
          <button
            onClick={() => handlePageChange(totalPages)}
            className="px-4 py-2 mx-1 rounded-lg bg-gray-200 text-[var(--text-primary)] hover:bg-gray-300 text-sm font-medium transition-all duration-200"
            disabled={isSubmitting}
          >
            {totalPages}
          </button>
        </>
      )}
      <button
        onClick={() => handlePageChange(currentValidPage + 1)}
        className="px-4 py-2 mx-1 rounded-lg bg-gray-200 text-[var(--text-primary)] hover:bg-gray-300 text-sm font-medium transition-all duration-200"
        disabled={currentValidPage === totalPages || isSubmitting}
      >
        Sau
      </button>
    </div>
  );
}

export default Pagination;