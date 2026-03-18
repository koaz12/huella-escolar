// src/components/Skeleton.jsx
export function Skeleton({ width, height, className = '', style = {} }) {
  return (
    <div 
      className={`bg-slate-200 rounded-lg animate-pulse ${className}`}
      style={{
        width: width || '100%',
        height: height || '20px',
        ...style
      }}
    />
  );
}