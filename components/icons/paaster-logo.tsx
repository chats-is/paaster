import * as React from "react";

type PaasterLogoProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
};

// The Paaster mark: the desk's sealed fan of sheets reduced to an icon —
// three sheets drawn together, the front one written on, and the yellow
// expiry sticker on its corner. 48 × 48 grid; the drawing is scaled to the
// 40-wide live area and centred on its visible bounds. Same drawing as
// public/logo.svg.
export function PaasterLogo({ size = 26, ...props }: PaasterLogoProps) {
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
      <g transform="translate(24 24) scale(0.8734) translate(-24 -22.75)">
        {/* the two sheets behind, fanned from a shared point below */}
        <rect
          x="9"
          y="9"
          width="17"
          height="25"
          rx="2.6"
          fill="#2a6fd6"
          transform="rotate(-16 24 42)"
        />
        <rect
          x="22"
          y="9"
          width="17"
          height="25"
          rx="2.6"
          fill="#8ec5ff"
          transform="rotate(16 24 42)"
        />
        <rect
          x="15.5"
          y="6"
          width="17"
          height="25"
          rx="2.6"
          fill="#fff"
          stroke="#2a6fd6"
          strokeWidth="1.6"
        />
        <path
          d="M19.5 13h9M19.5 17h9M19.5 21h5.4"
          stroke="#9ec4f3"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle
          cx="33.5"
          cy="33.5"
          r="6"
          fill="#ffc82e"
          stroke="#fff"
          strokeWidth="1.6"
        />
      </g>
    </svg>
  );
}
