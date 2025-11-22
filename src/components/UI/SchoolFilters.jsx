// src/components/UI/SchoolFilters.jsx
import React from 'react';

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

  // Definimos las opciones
  const levels = ['Primaria', 'Secundaria'];
  const shifts = ['Matutina', 'Vespertina', 'Extendida'];
  const grades = ['1ro', '2do', '3ro', '4to', '5to', '6to'];
  const sections = ['A', 'B', 'C', 'D', 'E'];

  // Helper para renderizar opciones
  const renderOptions = (items, label) => (
    <>
      {showAllOption && <option value="Todos">Todos {label}</option>}
      {items.map(item => <option key={item} value={item}>{item}</option>)}
    </>
  );

  // Estilo del contenedor (Grid o Flex)
  const containerStyle = layout === 'grid' 
    ? { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '5px' }
    : { display: 'flex', gap: '8px', flexWrap: 'wrap' };

  return (
    <div style={containerStyle}>
      <select 
        value={filters.level} 
        onChange={(e) => handleChange('level', e.target.value)} 
        style={commonStyle}
      >
        {renderOptions(levels, 'Niveles')}
      </select>

      <select 
        value={filters.shift} 
        onChange={(e) => handleChange('shift', e.target.value)} 
        style={commonStyle}
      >
        {renderOptions(shifts, 'Tandas')}
      </select>

      <select 
        value={filters.grade} 
        onChange={(e) => handleChange('grade', e.target.value)} 
        style={commonStyle}
      >
        {renderOptions(grades, 'Grados')}
      </select>

      <select 
        value={filters.section} 
        onChange={(e) => handleChange('section', e.target.value)} 
        style={commonStyle}
      >
        {renderOptions(sections, 'Sec.')}
      </select>
    </div>
  );
}