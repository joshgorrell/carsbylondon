/**
 * ShieldBadge — SVG recreation of the London Tint & Detail logo.
 * Royal blue shield with chrome "L" lettermark and white outline.
 */
export default function ShieldBadge({ className = '', size = 40 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shield-bg" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1a35d4" />
          <stop offset="100%" stopColor="#0d1e80" />
        </linearGradient>
        <linearGradient id="shield-shine" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="chrome-l" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#d8e0ea" />
          <stop offset="55%" stopColor="#8a9ab0" />
          <stop offset="80%" stopColor="#c8d4e0" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <path d="M32 2 L60 13 L60 36 C60 54 48 60 32 63 C16 60 4 54 4 36 L4 13 Z"
        fill="url(#shield-bg)" stroke="#2e3545" strokeWidth="1.5" />
      <path d="M32 5 L57 15 L57 36 C57 52 46 57 32 60 C18 57 7 52 7 36 L7 15 Z"
        fill="url(#shield-shine)" />
      <text x="32" y="47" fontFamily="Bebas Neue, Impact, sans-serif" fontSize="38" fontWeight="700"
        textAnchor="middle" fill="url(#chrome-l)">L</text>
      <circle cx="10" cy="20" r="1" fill="#ffffff" opacity="0.4" />
      <circle cx="54" cy="20" r="1" fill="#ffffff" opacity="0.4" />
    </svg>
  )
}
