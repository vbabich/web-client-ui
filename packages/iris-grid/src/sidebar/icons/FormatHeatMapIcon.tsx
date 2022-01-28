import * as React from 'react';

function SvgBarIcon(
  props: JSX.IntrinsicAttributes & React.SVGProps<SVGSVGElement>
): JSX.Element {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    >
      <rect width="48" height="48" fill="none" />
      <rect x="28" y="40" width="15" height="4" fill="#9FDE70" />
      <rect x="28" y="34" width="15" height="4" fill="#BFDC69" />
      <rect x="28" y="28" width="15" height="4" fill="#DFDB63" />
      <rect x="28" y="22" width="15" height="4" fill="#FFD95C" />
      <rect x="28" y="16" width="15" height="4" fill="#FFB06A" />
      <rect x="28" y="10" width="15" height="4" fill="#FF8879" />
      <rect x="28" y="4" width="15" height="4" fill="#FF5F87" />
    </svg>
  );
}

export default SvgBarIcon;