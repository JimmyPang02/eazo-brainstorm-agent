export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 28 28"
      width={size}
      height={size}
      className="text-[color:var(--green-500)]"
      aria-hidden="true"
    >
      <path d="M14 26 V12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path
        d="M14 14 C 6 14, 6 6, 14 4 C 22 6, 22 14, 14 14 Z"
        fill="currentColor"
        opacity="0.85"
      />
      <circle cx="14" cy="9" r="1.6" fill="#fff" opacity="0.95" />
      <path
        d="M14 17 C 10 16, 8 14, 8 14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M14 20 C 18 19, 20 17, 20 17"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
    </svg>
  );
}
