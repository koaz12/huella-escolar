// src/components/UI/SchoolFilters.jsx
import React from 'react';
import { LEVELS, SHIFTS, GRADES, SECTIONS } from '../../utils/constants';

export function SchoolFilters({ filters, onChange, showAllOption = true, layout = 'grid' }) {
  
  const handleChange = (field, value) => {
    onChange(prev => ({ ...prev, [field]: value }));
  };

  const renderOptions = (items, label) => (
    <>
      {showAllOption && <option value="Todos">Todos {label}</option>}
      {items.map(item => <option key={item} value={item}>{item}</option>)}
    </>
  );

  const containerClass = layout === 'grid' 
    ? "grid grid-cols-4 gap-1.5" 
    : "flex gap-2 flex-wrap";

  const selectClass = "p-2 rounded-lg border border-color text-xs w-full bg-card focus:border-accent-color focus:outline-none";

  return (
    <div className={containerClass}>
      <select value={filters.level} onChange={(e) => handleChange('level', e.target.value)} className={selectClass}>
        {renderOptions(LEVELS, 'Niveles')}
      </select>

      <select value={filters.shift} onChange={(e) => handleChange('shift', e.target.value)} className={selectClass}>
        {renderOptions(SHIFTS, 'Tandas')}
      </select>

      <select value={filters.grade} onChange={(e) => handleChange('grade', e.target.value)} className={selectClass}>
        {renderOptions(GRADES, 'Grados')}
      </select>

      <select value={filters.section} onChange={(e) => handleChange('section', e.target.value)} className={selectClass}>
        {renderOptions(SECTIONS, 'Sec.')}
      </select>
    </div>
  );
}