import * as React from "react";

type PasswordIconProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
};

// A rounded field holding three asterisks: a filled-in password box.
// Same 24×24 grid and props as the lucide icons used elsewhere (lucide has no
// equivalent). The default stroke is 1.5 rather than 2: three asterisks only
// stay legible inside the capsule with the lighter line.
export function PasswordIcon({
  size = 24,
  strokeWidth = 1.5,
  ...props
}: PasswordIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* 2px safe margin on every side, like the other 24×24 icons */}
      <rect x="2" y="7" width="20" height="10" rx="3" />
      {[7, 12, 17].map((cx) => (
        <g key={cx}>
          <path d={`M${cx} 10.4v3.2`} />
          <path d={`M${cx - 1.39} 11.2l2.77 1.6`} />
          <path d={`M${cx + 1.39} 11.2l-2.77 1.6`} />
        </g>
      ))}
    </svg>
  );
}
