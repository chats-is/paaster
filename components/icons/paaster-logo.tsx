import * as React from "react";

type PaasterLogoProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
};

const BACK =
  "M5 13.5A4 4 0 0 1 9 9.5H18a2.5 2.5 0 0 1 1.9.87l1.3 1.5a2.5 2.5 0 0 0 1.9.87H38.5A4.5 4.5 0 0 1 43 17.24V24H5z";
const FRONT =
  "M5 24.5A3.5 3.5 0 0 1 8.5 21h31a3.5 3.5 0 0 1 3.5 3.5V36a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z";

// The Paaster mark: the site's folder reduced to an icon — two cards fanned
// inside, the frosted front, a one-line title pill and the yellow expiry
// sticker. 48 × 48 grid, drawing fills the 40-wide live area and is centred.
// Same drawing as public/logo.svg.
export function PaasterLogo({ size = 26, ...props }: PaasterLogoProps) {
  const id = React.useId();
  const back = `${id}-back`;
  const front = `${id}-front`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient
          id={back}
          x1="0"
          y1="8"
          x2="0"
          y2="41"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#4d97f2" />
          <stop offset="1" stopColor="#2a6fd6" />
        </linearGradient>
        <linearGradient
          id={front}
          x1="0"
          y1="18"
          x2="0"
          y2="41"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#8ec5ff" />
          <stop offset="1" stopColor="#4f9af2" />
        </linearGradient>
      </defs>
      <g transform="translate(24 24) scale(1.0526) translate(-24 -25.25)">
        <path d={BACK} fill={`url(#${back})`} />
        {/* two cards, fanned from their bottom centres as on the page */}
        <rect
          x="16.8"
          y="14.8"
          width="10"
          height="17"
          rx="1.4"
          fill="#dce9f8"
          transform="rotate(-3.5 21.8 31.8)"
        />
        <rect
          x="21.2"
          y="14.8"
          width="10"
          height="17"
          rx="1.4"
          fill="#fff"
          transform="rotate(3.5 26.2 31.8)"
        />
        <path d={FRONT} fill={`url(#${front})`} />
        <rect x="9.5" y="29.5" width="18" height="5" rx="2.5" fill="#fff" />
        <circle cx="36" cy="32" r="3.8" fill="#ffc82e" />
      </g>
    </svg>
  );
}
