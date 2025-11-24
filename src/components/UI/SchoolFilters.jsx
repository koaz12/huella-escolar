// src/components/UI/SchoolFilters.jsx
import React from 'react';
// 1. IMPORTAMOS LAS CONSTANTES (Subimos 2 niveles ../../)
import { LEVELS, SHIFTS, GRADES, SECTIONS } from '../../utils/constants';

export function SchoolFilters({ filters, onChange, showAllOption = true, layout = 'grid' }) {
  
  const handleChange = (field, value) => {
    onChange(prev => ({ ...prev, [field]: value }));
  };

  const commonStyle = {
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '12px',
    width: '100%',
    backgroundColor: 'white',
    outline: 'none'
  };

  // 2. USAMOS LAS CONSTANTES IMPORTADAS (Ya no están escritas a mano aquí)
  const renderOptions = (items, label) => (
    <>
      {showAllOption && <option value="Todos">Todos {label}</option>}
      {items.map(item => <option key={item} value={item}>{item}</option>)}
    </>
  );

  const containerStyle = layout === 'grid' 
    ? { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '5px' }
    : { display: 'flex', gap: '8px', flexWrap: 'wrap' };

  return (
    <div style={containerStyle}>
      <select value={filters.level} onChange={(e) => handleChange('level', e.target.value)} style={commonStyle}>
        {renderOptions(LEVELS, 'Niveles')}
      </select>

      <select value={filters.shift} onChange={(e) => handleChange('shift', e.target.value)} style={commonStyle}>
        {renderOptions(SHIFTS, 'Tandas')}
      </select>

      <select value={filters.grade} onChange={(e) => handleChange('grade', e.target.value)} style={commonStyle}>
        {renderOptions(GRADES, 'Grados')}
      </select>

      <select value={filters.section} onChange={(e) => handleChange('section', e.target.value)} style={commonStyle}>
        {renderOptions(SECTIONS, 'Sec.')}
      </select>
    </div>
  );
}