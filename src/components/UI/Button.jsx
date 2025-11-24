import React from 'react';

export function Button({ 
  children, onClick, variant = 'primary', type = 'button', disabled = false, style = {} 
}) {
  const variants = {
    primary: { background: '#2563eb', color: 'white', border: 'none', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)' },
    secondary: { background: '#f3f4f6', color: '#334155', border: '1px solid #cbd5e1', boxShadow: 'none' },
    danger: { background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', boxShadow: 'none' },
    outline: { background: 'transparent', color: '#2563eb', border: '2px solid #2563eb', boxShadow: 'none' }
  };

  const baseStyle = {
    padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    transition: 'all 0.2s', width: '100%', ...variants[variant], ...style
  };

  return <button type={type} onClick={onClick} disabled={disabled} style={baseStyle}>{children}</button>;
}