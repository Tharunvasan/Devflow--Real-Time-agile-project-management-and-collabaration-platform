import React from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string;
  icon?: React.ReactNode;
}

export const Breadcrumbs: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => {
  return (
    <nav className="flex items-center text-xs text-slate-400 space-x-1.5 overflow-x-auto py-1" aria-label="Breadcrumb">
      <Link
        to="/dashboard"
        className="flex items-center hover:text-white transition-colors"
        title="Dashboard"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            <span className="text-slate-600 select-none">/</span>
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="flex items-center gap-1 hover:text-white transition-colors truncate max-w-[150px]"
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </Link>
            ) : (
              <span className="flex items-center gap-1 text-slate-200 font-medium truncate max-w-[200px]" aria-current="page">
                {item.icon}
                <span className="truncate">{item.label}</span>
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
