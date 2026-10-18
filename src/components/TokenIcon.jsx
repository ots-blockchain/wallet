import React from 'react';

export const OtsCoinIcon = ({ size = 26, style = {}, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="32 32 192 192"
    fill="none"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <path
      fill="#008cff"
      d="M102.2 151c.8 5.2 2.4 9.2 4.4 12 4 4.8 10.8 7.2 20.8 7.2 6 0 10.4-.8 14.4-2 6.8-2.4 10.4-6.8 10.4-13.6 0-4-1.6-6.8-5.2-8.8-3.2-2-8.8-4-16-5.6l-12.4-2.8c-12.4-2.8-20.8-5.6-25.6-8.8-8-5.2-11.6-13.6-11.6-25.2 0-10.4 4-19.2 11.6-26 7.6-6.8 18.8-10.4 33.6-10.4 12.4 0 22.8 3.2 31.6 9.6 8.8 6.4 13.2 16 13.6 28.4h-23.2c-.4-6.8-3.6-12-9.2-14.8-4-2-8.8-2.8-14.4-2.8-6.4 0-11.6 1.2-15.2 3.6-3.6 2.4-5.6 6-5.6 10.4 0 4 2 7.2 5.6 9.2 2.4 1.2 7.6 2.8 15.6 4.8l20.4 4.8c8.8 2 15.6 4.8 20 8.4 6.8 5.6 10.4 13.2 10.4 23.6 0 10.8-4 19.6-12.4 26.4-8 7.2-19.6 10.4-34.8 10.4-15.2 0-27.2-3.6-36-10.4-9.6-6-14-15.6-14-27.6h23.2Z"
    />
    <path fill="#008cff" d="M117 56h23v144h-23z" />
    <circle cx="128" cy="128" r="84" stroke="#008cff" strokeWidth="24" />
  </svg>
);

export const GramCoinIcon = ({ size = 26, style = {}, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <rect width="100" height="100" rx="50" fill="#30A1F5" />
    <rect x=".5" y=".5" width="99" height="99" rx="49.5" stroke="#000" strokeOpacity=".06" />
    <path
      d="M60.41 26.75H39.59c-2.772 0-4.159 0-5.413.388a8.691 8.691 0 0 0-3.028 1.653c-1.005.846-1.754 2.012-3.254 4.344L21.277 43.43c-.99 1.54-1.486 2.311-1.62 3.122-.119.715-.04 1.45.228 2.123.304.764.951 1.411 2.247 2.707l24.59 24.59c1.148 1.148 1.721 1.722 2.383 1.936.582.19 1.208.19 1.79 0 .661-.214 1.235-.788 2.382-1.935l24.591-24.591c1.296-1.296 1.943-1.943 2.247-2.707a3.982 3.982 0 0 0 .228-2.123c-.134-.81-.63-1.581-1.62-3.122l-6.618-10.295c-1.5-2.332-2.25-3.498-3.254-4.344a8.692 8.692 0 0 0-3.028-1.653c-1.255-.388-2.64-.388-5.414-.388z"
      fill="#fff"
    />
    <path
      d="M56.469 34.871c.338-.914 1.631-.914 1.97 0l2.337 6.317c.14.38.44.679.819.82l6.317 2.337c.914.338.914 1.63 0 1.97l-6.317 2.337c-.38.14-.679.44-.82.818l-2.337 6.317c-.338.915-1.631.915-1.97 0l-2.337-6.317c-.14-.379-.44-.678-.819-.818l-6.316-2.338c-.915-.338-.915-1.631 0-1.97l6.316-2.337c.38-.14.679-.44.82-.819l2.337-6.317z"
      fill="#30A1F5"
    />
  </svg>
);

const ICON_MAP = {
  OTS: OtsCoinIcon,
  GRAM: GramCoinIcon
};

export default function TokenIcon({ token, size = 26, style = {}, className = '' }) {
  const IconComponent = ICON_MAP[token] || OtsCoinIcon;
  return <IconComponent size={size} style={style} className={className} />;
}
