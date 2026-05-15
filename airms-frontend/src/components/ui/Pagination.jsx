import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '../ui/Button';

const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.pages <= 1) return null;

  const { page, pages, total } = pagination;

  return (
    <div className="flex items-center justify-between px-8 py-6 bg-slate-50/50 border-t border-slate-100">
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        Showing Page <span className="text-slate-900">{page}</span> of <span className="text-slate-900">{pages}</span>
        <span className="mx-2 opacity-20">|</span>
        Total <span className="text-blue-600">{total}</span> records
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-10 px-4 rounded-xl bg-white border border-slate-100 text-slate-600 disabled:opacity-30 shadow-sm"
        >
          <ChevronLeft size={16} className="mr-1" /> Previous
        </Button>
        
        <div className="flex items-center gap-1 mx-2">
          {Array.from({ length: Math.min(5, pages) }).map((_, i) => {
            // Simple logic for showing a few page numbers
            let pageNum;
            if (pages <= 5) pageNum = i + 1;
            else if (page <= 3) pageNum = i + 1;
            else if (page >= pages - 2) pageNum = pages - 4 + i;
            else pageNum = page - 2 + i;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all ${
                  page === pageNum 
                    ? 'bg-slate-900 text-white shadow-lg' 
                    : 'bg-white text-slate-400 hover:text-slate-900 border border-slate-100'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          className="h-10 px-4 rounded-xl bg-white border border-slate-100 text-slate-600 disabled:opacity-30 shadow-sm"
        >
          Next <ChevronRight size={16} className="ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
