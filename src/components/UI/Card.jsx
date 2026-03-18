import React from 'react';

export function Card({ children, title, icon: Icon, actions, gradient }) {
  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm mb-4 overflow-hidden transition-colors duration-300`}>
      {(title || actions) && (
        <div className={`flex justify-between items-center px-5 py-4 border-b border-slate-100 dark:border-white/5 ${gradient ? 'bg-gradient-to-r ' + gradient : ''}`}>
          {title && (
            <h3 className="m-0 text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 tracking-wide uppercase">
              {Icon && <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center"><Icon size={16} className="text-blue-600 dark:text-blue-400"/></span>}
              {title}
            </h3>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">
        {children}
      </div>
    </div>
  );
}