import React from 'react';

export function Button({ 
  children, onClick, variant = 'primary', type = 'button', disabled = false, className = '' 
}) {
  const variantClass = variant === 'primary' ? 'btn-primary' : 
                       variant === 'secondary' ? 'btn-secondary' : 
                       variant === 'danger' ? 'bg-danger-bg text-danger-text border border-danger-text' : 
                       variant === 'outline' ? 'bg-transparent text-accent-color border-2 border-accent-color' : '';

  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled} 
      className={`btn ${variantClass} w-full ${className}`}
    >
      {children}
    </button>
  );
}