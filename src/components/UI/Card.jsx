import React from 'react';

export function Card({ children, title, icon: Icon, actions }) {
  return (
    <div style={{
      backgroundColor: 'white', padding: '20px', borderRadius: '16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', marginBottom: '20px'
    }}>
      {(title || actions) && (
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
            {title && <h3 style={{margin:0, fontSize:'18px', color:'#1e293b', display:'flex', alignItems:'center', gap:'8px'}}>{Icon && <Icon size={20} color="#2563eb"/>}{title}</h3>}
            {actions && <div>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}