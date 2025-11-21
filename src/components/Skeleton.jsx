// src/components/Skeleton.jsx
export function Skeleton({ width, height, style }) {
  return (
    <div 
      style={{
        width: width || '100%',
        height: height || '20px',
        backgroundColor: '#e2e8f0', // Gris claro
        borderRadius: '8px',
        animation: 'pulse 1.5s infinite ease-in-out',
        ...style
      }}
    >
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}