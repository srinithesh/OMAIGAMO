import React from 'react';

export const Logo = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    className={className}
    aria-label="Veridian Fleet Logo"
  >
    <defs>
      <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#20C295', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#00DF81', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <path
      d="M50 5 L95 25 L95 75 L50 95 L5 75 L5 25 Z"
      stroke="url(#grad1)"
      strokeWidth="5"
      fill="none"
    />
    <path
      d="M25 35 L50 20 L75 35 L75 65 L50 80 L25 65 Z"
      fill="#095544"
      fillOpacity="0.5"
    />
    <path
      d="M30 60 L50 48 L70 60"
      stroke="#F1F7F5"
      strokeWidth="6"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M50 48 V 70"
      stroke="#F1F7F5"
      strokeWidth="6"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);
