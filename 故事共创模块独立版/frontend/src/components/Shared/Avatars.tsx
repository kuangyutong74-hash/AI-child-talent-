/**
 * Story Co-Create — Character Avatar SVGs
 * Cute character illustrations replacing emoji avatars.
 */

interface AvatarProps {
  size?: number;
  className?: string;
}

/* ═══════════════════════════════════════════
   Story Director — 故事导演
   Wise owl/director figure with glasses
   ═══════════════════════════════════════════ */
export function DirectorAvatar({ size = 48, className }: AvatarProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="故事导演">
      {/* Face */}
      <circle cx="32" cy="34" r="22" fill="url(#dirFace)" />
      {/* Ears */}
      <ellipse cx="14" cy="20" rx="7" ry="9" fill="url(#dirEar)" />
      <ellipse cx="50" cy="20" rx="7" ry="9" fill="url(#dirEar)" />
      <ellipse cx="14" cy="20" rx="4" ry="6" fill="#FFE8D6" />
      <ellipse cx="50" cy="20" rx="4" ry="6" fill="#FFE8D6" />
      {/* Glasses */}
      <circle cx="25" cy="32" r="9" fill="none" stroke="#6B5EA0" strokeWidth="2.5" />
      <circle cx="39" cy="32" r="9" fill="none" stroke="#6B5EA0" strokeWidth="2.5" />
      <line x1="34" y1="32" x2="30" y2="32" stroke="#6B5EA0" strokeWidth="2" />
      {/* Eyes */}
      <circle cx="25" cy="32" r="3" fill="#3D3758" />
      <circle cx="39" cy="32" r="3" fill="#3D3758" />
      <circle cx="26" cy="30" r="1" fill="white" />
      <circle cx="40" cy="30" r="1" fill="white" />
      {/* Eyebrows */}
      <path d="M18 26c2-2 5-3 8-2" stroke="#6B5EA0" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M38 24c3-1 6 0 8 2" stroke="#6B5EA0" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Beak / mouth */}
      <path d="M29 38l3 4 3-4" stroke="#E88060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Cap */}
      <path d="M10 16c0-4 10-6 22-6s22 2 22 6l-4 4H14l-4-4z" fill="url(#dirCap)" />
      <rect x="12" y="12" width="40" height="5" rx="2" fill="#5A3E28" />
      <defs>
        <linearGradient id="dirFace" x1="10" y1="12" x2="54" y2="56">
          <stop stopColor="#FFD4BA" /><stop offset="1" stopColor="#FFB88C" />
        </linearGradient>
        <linearGradient id="dirEar" x1="7" y1="11" x2="21" y2="29">
          <stop stopColor="#FFC9A5" /><stop offset="1" stopColor="#FFB080" />
        </linearGradient>
        <linearGradient id="dirCap" x1="10" y1="10" x2="54" y2="20">
          <stop stopColor="#9B8FD4" /><stop offset="1" stopColor="#7B6EC0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ═══════════════════════════════════════════
   Child Explorer — 小探险家
   Cute young explorer face
   ═══════════════════════════════════════════ */
export function ChildAvatar({ size = 48, className }: AvatarProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="小探险家">
      {/* Face */}
      <circle cx="32" cy="34" r="22" fill="url(#childFace)" />
      {/* Hair */}
      <path d="M10 30c0-12 10-22 22-22s22 10 22 22c0 4-1 8-3 12-1-3-3-5-6-6-4 0-8 1-12 1s-9-1-13-1c-3 1-5 3-7 6-2-4-3-8-3-12z"
        fill="url(#childHair)" />
      {/* Bangs */}
      <path d="M12 28c2-8 8-14 20-14s18 6 20 14c-1-4-8-7-20-7s-19 3-20 7z" fill="#4A3728" />
      {/* Eyes */}
      <ellipse cx="24" cy="34" rx="4" ry="5" fill="#3D3758" />
      <ellipse cx="40" cy="34" rx="4" ry="5" fill="#3D3758" />
      <circle cx="25.5" cy="32" r="1.5" fill="white" />
      <circle cx="41.5" cy="32" r="1.5" fill="white" />
      {/* Blush */}
      <ellipse cx="18" cy="38" rx="5" ry="3" fill="#FFB3B3" opacity=".4" />
      <ellipse cx="46" cy="38" rx="5" ry="3" fill="#FFB3B3" opacity=".4" />
      {/* Smile */}
      <path d="M26 42c3 4 7 4 12 0" stroke="#E88060" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Cap */}
      <path d="M14 18c6-4 14-6 18-6s12 2 18 6l-3 4H17l-3-4z" fill="url(#childCap)" />
      <circle cx="32" cy="12" r="3" fill="#FFD66D" />
      <defs>
        <linearGradient id="childFace" x1="10" y1="12" x2="54" y2="56">
          <stop stopColor="#FFECD8" /><stop offset="1" stopColor="#FFD4BA" />
        </linearGradient>
        <linearGradient id="childHair" x1="10" y1="10" x2="54" y2="30">
          <stop stopColor="#4A3728" /><stop offset="1" stopColor="#3A2718" />
        </linearGradient>
        <linearGradient id="childCap" x1="14" y1="12" x2="50" y2="22">
          <stop stopColor="#8ECAE6" /><stop offset="1" stopColor="#6DB0D0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ═══════════════════════════════════════════
   Story Fairy — 故事精灵
   Tiny fairy with wings and a sparkle
   ═══════════════════════════════════════════ */
export function FairyAvatar({ size = 48, className }: AvatarProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="故事精灵">
      {/* Glow */}
      <circle cx="32" cy="34" r="26" fill="url(#fairyGlow)" opacity=".3" />
      {/* Wings */}
      <ellipse cx="12" cy="26" rx="10" ry="14" fill="url(#wingLeft)" opacity=".7"
        transform="rotate(-20 12 26)" />
      <ellipse cx="52" cy="26" rx="10" ry="14" fill="url(#wingRight)" opacity=".7"
        transform="rotate(20 52 26)" />
      {/* Wing details */}
      <path d="M8 18c3 4 4 10 3 16" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" fill="none" />
      <path d="M56 18c-3 4-4 10-3 16" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" fill="none" />
      {/* Body */}
      <ellipse cx="32" cy="40" rx="10" ry="8" fill="url(#fairyBody)" />
      {/* Face */}
      <circle cx="32" cy="30" r="11" fill="url(#fairyFace)" />
      {/* Hair */}
      <path d="M21 28c0-7 5-12 11-12s11 5 11 12c-1 4-4 7-8 7h-6c-4 0-7-3-8-7z" fill="#FFE066" />
      <path d="M23 22c2-3 5-4 9-4s7 1 9 4" fill="#FFD43B" />
      {/* Eyes */}
      <ellipse cx="27.5" cy="31" rx="2.8" ry="3.5" fill="#3D3758" />
      <ellipse cx="36.5" cy="31" rx="2.8" ry="3.5" fill="#3D3758" />
      <circle cx="28.5" cy="29.5" r="1" fill="white" />
      <circle cx="37.5" cy="29.5" r="1" fill="white" />
      {/* Blush */}
      <ellipse cx="23" cy="34" rx="4" ry="2.5" fill="#FFB3B3" opacity=".4" />
      <ellipse cx="41" cy="34" rx="4" ry="2.5" fill="#FFB3B3" opacity=".4" />
      {/* Smile */}
      <path d="M28 36c2 2.5 5 2.5 8 0" stroke="#E88060" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Sparkle wand */}
      <line x1="42" y1="22" x2="52" y2="12" stroke="#FFD66D" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="52" cy="12" r="3" fill="#FFEAA7" />
      <circle cx="52" cy="12" r="1.5" fill="#FFD66D" />
      <defs>
        <linearGradient id="fairyFace" x1="21" y1="19" x2="43" y2="41">
          <stop stopColor="#FFF8F0" /><stop offset="1" stopColor="#FFE8D6" />
        </linearGradient>
        <linearGradient id="fairyBody" x1="22" y1="32" x2="42" y2="48">
          <stop stopColor="#CBC4E8" /><stop offset="1" stopColor="#9B8FD4" />
        </linearGradient>
        <linearGradient id="wingLeft" x1="2" y1="12" x2="22" y2="40">
          <stop stopColor="#E8E2FF" /><stop offset="1" stopColor="#CBC4E8" />
        </linearGradient>
        <linearGradient id="wingRight" x1="62" y1="12" x2="42" y2="40">
          <stop stopColor="#E8E2FF" /><stop offset="1" stopColor="#CBC4E8" />
        </linearGradient>
        <radialGradient id="fairyGlow" cx="32" cy="34" r="26">
          <stop stopColor="#FFEAA7" /><stop offset="1" stopColor="transparent" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/* ═══════════════════════════════════════════
   Robot Buddy — 机器人小伙伴 (for fun)
   ═══════════════════════════════════════════ */
export function RobotAvatar({ size = 48, className }: AvatarProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="机器人伙伴">
      {/* Antenna */}
      <line x1="32" y1="4" x2="32" y2="10" stroke="#9B8FD4" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="3" r="3" fill="#FF8FAB" />
      {/* Head */}
      <rect x="14" y="10" width="36" height="30" rx="10" fill="url(#robotHead)" />
      {/* Ears */}
      <rect x="6" y="18" width="8" height="14" rx="4" fill="url(#robotEar)" />
      <rect x="50" y="18" width="8" height="14" rx="4" fill="url(#robotEar)" />
      {/* Eyes */}
      <circle cx="24" cy="26" r="6" fill="white" />
      <circle cx="40" cy="26" r="6" fill="white" />
      <circle cx="26" cy="26" r="3" fill="#3D3758" />
      <circle cx="42" cy="26" r="3" fill="#3D3758" />
      <circle cx="27" cy="24" r="1" fill="white" />
      <circle cx="43" cy="24" r="1" fill="white" />
      {/* Mouth — LED grid */}
      <rect x="22" y="34" width="20" height="6" rx="3" fill="#3D3758" />
      <rect x="26" y="35" width="3" height="4" rx="1" fill="#7ECFC0" />
      <rect x="31" y="35" width="3" height="4" rx="1" fill="#7ECFC0" />
      <rect x="36" y="35" width="3" height="4" rx="1" fill="#7ECFC0" />
      {/* Body */}
      <rect x="18" y="44" width="28" height="8" rx="4" fill="url(#robotBody)" />
      <circle cx="26" cy="48" r="2" fill="#FF8FAB" />
      <circle cx="38" cy="48" r="2" fill="#8ECAE6" />
      <defs>
        <linearGradient id="robotHead" x1="14" y1="10" x2="50" y2="40">
          <stop stopColor="#E8E5F8" /><stop offset="1" stopColor="#D5D0EE" />
        </linearGradient>
        <linearGradient id="robotEar" x1="6" y1="18" x2="14" y2="32">
          <stop stopColor="#BFB8E0" /><stop offset="1" stopColor="#9B8FD4" />
        </linearGradient>
        <linearGradient id="robotBody" x1="18" y1="44" x2="46" y2="52">
          <stop stopColor="#D5D0EE" /><stop offset="1" stopColor="#BFB8E0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
