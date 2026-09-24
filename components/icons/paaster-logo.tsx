import * as React from "react";

type PaasterLogoProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
};

const FILE =
  "M10 6h13.4a2.2 2.2 0 0 1 1.56.64l6.4 6.4A2.2 2.2 0 0 1 32 14.6V38a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z";
const SHACKLE = "M29.7 31v-2.9a3.5 3.5 0 0 1 7 0V31";

// The Paaster mark: a document sealed with a padlock, in the brand gradient.
// The fold, text lines and keyhole are cut out (masks), so it sits on any
// background. Same drawing as public/logo.svg.
export function PaasterLogo({ size = 26, ...props }: PaasterLogoProps) {
  const id = React.useId();
  const gradient = `${id}-g`;
  const fileMask = `${id}-f`;
  const lockMask = `${id}-l`;
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
          id={gradient}
          x1="4"
          y1="4"
          x2="44"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#2563eb" />
          <stop offset=".6" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
        <mask id={fileMask} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          {/* folded corner */}
          <path
            d="M24.3 6v5.8a2.4 2.4 0 0 0 2.4 2.4H32"
            stroke="#000"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          {/* text lines */}
          <rect x="11" y="19" width="13" height="2.2" rx="1.1" fill="#000" />
          <rect x="11" y="24.2" width="10" height="2.2" rx="1.1" fill="#000" />
          <rect x="11" y="29.4" width="7" height="2.2" rx="1.1" fill="#000" />
          {/* even gap around the padlock */}
          <rect x="24" y="29" width="18.4" height="15" rx="5" fill="#000" />
          <path d={SHACKLE} stroke="#000" strokeWidth="6.6" strokeLinecap="round" />
        </mask>
        <mask id={lockMask} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          {/* keyhole */}
          <circle cx="33.2" cy="35.6" r="1.7" fill="#000" />
          <path d="M32.4 36.4h1.6l.45 3h-2.5z" fill="#000" />
        </mask>
      </defs>
      {/* optically centred: the drawing spans x 6–40.4, y 6–42; its heavy
          top-left page is balanced by nudging it right and down */}
      <g transform="translate(1.8 .8)">
        <path d={FILE} fill={`url(#${gradient})`} mask={`url(#${fileMask})`} />
        <path
          d={SHACKLE}
          stroke={`url(#${gradient})`}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <rect
          x="26"
          y="31"
          width="14.4"
          height="11"
          rx="3"
          fill={`url(#${gradient})`}
          mask={`url(#${lockMask})`}
        />
      </g>
    </svg>
  );
}
