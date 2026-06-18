import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className, title, actions }) => {
  return (
    <div className={cn(
      'bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden transition-all duration-300 hover:border-gray-600 hover:shadow-xl hover:shadow-primary-500/5',
      className
    )}>
      {(title || actions) && (
        <div className="px-6 py-4 border-b border-gray-700/50 flex justify-between items-center">
          {title && (
            <h3 className="text-lg font-semibold text-white">
              {title}
            </h3>
          )}
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};