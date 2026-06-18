import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  current: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  totalItems: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  current,
  total,
  perPage,
  onPageChange,
  totalItems,
}) => {
  if (total <= 1) return null;

  const start = (current - 1) * perPage + 1;
  const end = Math.min(current * perPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-700/50">
      <p className="text-sm text-gray-400">
        Affichage de {start} à {end} sur {totalItems} patients
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(current - 1)}
          disabled={current === 1}
          className="p-2 rounded-lg hover:bg-gray-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-400"
        >
          <ChevronLeft size={18} />
        </button>
        {Array.from({ length: Math.min(total, 7) }, (_, i) => {
          let pageNum: number;
          if (total <= 7) {
            pageNum = i + 1;
          } else if (current <= 4) {
            pageNum = i + 1;
          } else if (current >= total - 3) {
            pageNum = total - 6 + i;
          } else {
            pageNum = current - 3 + i;
          }
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`
                w-9 h-9 rounded-lg text-sm font-medium transition-all
                ${pageNum === current 
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25' 
                  : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                }
              `}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(current + 1)}
          disabled={current === total}
          className="p-2 rounded-lg hover:bg-gray-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-400"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};