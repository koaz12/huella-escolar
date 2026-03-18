import React from 'react';

const baseInput = "w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 dark:focus:border-blue-500 transition-all text-sm font-medium shadow-inner";

export function Input({ label, className = '', ...props }) {
  return (
    <div className="mb-3 w-full">
      {label && <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>}
      <input className={`${baseInput} ${className}`} {...props} />
    </div>
  );
}

export function Select({ label, children, className = '', ...props }) {
  return (
    <div className="mb-3 w-full">
      {label && <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>}
      <select className={`${baseInput} cursor-pointer ${className}`} {...props}>
        {children}
      </select>
    </div>
  );
}