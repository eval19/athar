interface AtharLogoProps {
  className?: string;
}

export function AtharLogo({ className = 'h-9 w-9' }: AtharLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="15" fill="#0F5C4A" />
      <rect
        x="3.5"
        y="3.5"
        width="57"
        height="57"
        rx="12"
        stroke="#DFB968"
        strokeOpacity="0.32"
        strokeWidth="1"
      />
      <path
        d="M16 22C16 19.8 17.8 18 20 18H26.5C29.5 18 32 20.5 32 23.5V44.5C32 42.5 30.2 41 28 41H19.5C17.6 41 16 39.4 16 37.5V22Z"
        fill="#FAF9F6"
      />
      <path
        d="M48 22C48 19.8 46.2 18 44 18H37.5C34.5 18 32 20.5 32 23.5V44.5C32 42.5 33.8 41 36 41H44.5C46.4 41 48 39.4 48 37.5V22Z"
        fill="#ECE8DE"
      />
      <path d="M32 23V44.5" stroke="#0F5C4A" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M32 11.5L35.5 15L32 18.5L28.5 15L32 11.5Z" fill="#DFB968" />
      <path d="M20.5 25.5H27.5" stroke="#0F5C4A" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20.5 30H26.5" stroke="#0F5C4A" strokeOpacity="0.25" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M36.5 25.5H43.5" stroke="#0F5C4A" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M37.5 30H43.5" stroke="#0F5C4A" strokeOpacity="0.25" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M23.5 48.2H40.5" stroke="#DFB968" strokeOpacity="0.78" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
