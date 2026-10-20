// Decorative illustration. No map tiles, geolocation, external API or fabricated live position.
export function OrderIllustration({ large = false }: { large?: boolean }) {
  return (
    <svg
      className={large ? 'order-illustration large' : 'order-illustration'}
      viewBox="0 0 320 230"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M25 175C50 121 79 197 117 153S179 91 216 119 254 188 301 92"
        stroke="#EFC4BD"
        strokeWidth="2.5"
        strokeDasharray="6 7"
      />
      <ellipse cx="161" cy="198" rx="107" ry="12" fill="#EDD6CF" opacity=".45" />
      <rect
        x="88"
        y="70"
        width="144"
        height="119"
        rx="14"
        fill="#FFF"
        stroke="#F0D5CD"
        strokeWidth="2"
      />
      <path d="M88 84a14 14 0 0 1 14-14h116a14 14 0 0 1 14 14v16H88Z" fill="#FF5C5C" />
      <path
        d="M128 70V57c0-16 12-28 28-28h8c16 0 28 12 28 28v13"
        stroke="#D84343"
        strokeWidth="8"
      />
      <path
        d="M148 125h39M148 138h28M148 151h35"
        stroke="#DDD1CB"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="126" cy="126" r="5" fill="#FFB5A6" />
      <circle cx="126" cy="140" r="5" fill="#FFB5A6" />
      <circle cx="126" cy="154" r="5" fill="#FFB5A6" />
      <circle cx="225" cy="169" r="30" fill="#241E1C" />
      <path
        d="m212 170 9 9 17-20"
        stroke="#FFF"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M52 94c0-10 8-18 18-18s18 8 18 18c0 14-18 27-18 27S52 108 52 94Z" fill="#FF8B76" />
      <circle cx="70" cy="93" r="6" fill="#FFF" />
      <path d="m257 49 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z" fill="#E9B962" />
      <circle cx="59" cy="161" r="5" fill="#E9B962" />
      <circle cx="250" cy="103" r="4" fill="#FFB5A6" />
    </svg>
  );
}
