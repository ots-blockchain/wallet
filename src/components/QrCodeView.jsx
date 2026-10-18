import React, { useMemo } from 'react';
import { getQrSvgPaths } from '../utils/qr';

export default function QrCodeView({ value, size = 180, className = '' }) {
  const qrData = useMemo(() => {
    if (!value) return null;
    return getQrSvgPaths(value, size);
  }, [value, size]);

  if (!qrData) return null;

  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '12px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
      }}
    >
      <svg
        viewBox={qrData.viewBox}
        width="100%"
        height="100%"
        style={{ display: 'block' }}
      >
        <path d={qrData.pathData} fill="#000000" />
      </svg>
    </div>
  );
}
