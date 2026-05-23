export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 28 28"
      width={size}
      height={size}
      className="text-[color:var(--green-500)]"
      aria-hidden="true"
    >
      <path
        d="M14 13 L14 25"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14 13 Q 4 14 3 5 Q 13 4 14 13 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M14 13 Q 24 14 25 5 Q 15 4 14 13 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="14" cy="6" r="1.4" fill="currentColor" />
    </svg>
  );
}
