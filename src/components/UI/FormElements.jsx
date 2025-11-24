import React from 'react';

const baseStyle = {
  width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
  fontSize: '14px', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box',
  transition: 'border-color 0.2s'
};

export function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: '10px', width: '100%' }}>
      {label && <label style={{display:'block', fontSize:'11px', fontWeight:'bold', color:'#64748b', marginBottom:'4px'}}>{label}</label>}
      <input style={baseStyle} onFocus={(e) => e.target.style.borderColor = '#2563eb'} onBlur={(e) => e.target.style.borderColor = '#cbd5e1'} {...props} />
    </div>
  );
}

export function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom: '10px', width: '100%' }}>
      {label && <label style={{display:'block', fontSize:'11px', fontWeight:'bold', color:'#64748b', marginBottom:'4px'}}>{label}</label>}
      <select style={{...baseStyle, appearance: 'none', backgroundColor:'white'}} {...props}>
        {children}
      </select>
    </div>
  );
}