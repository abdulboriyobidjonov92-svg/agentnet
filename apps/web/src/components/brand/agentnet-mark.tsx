/**
 * AGENTNET BRAND BELGISI.
 *
 * NEGA SVG, RASM EMAS: brend tasviri 1024px li render — yulduz changi,
 * blyor va spekulyar nurlar bilan. 32px da bularning hammasi loyqaga
 * aylanadi va belgi "iflos dog'" bo'lib ko'rinadi. Shu o'lchamda o'qiladigan
 * narsa faqat GEOMETRIYA: oltita tugun, ularni bog'lovchi ramka va
 * markazdagi oltiburchak. Vektor esa har o'lchamda aniq va 2 KB dan kichik.
 *
 * GEOMETRIYA (rasmdan olingan):
 *   · oltita tugun 60° oralig'ida, tepada va pastda bittadan (−90°dan
 *     boshlab) — bu hero'dagi orbitaning aynan o'sha olti burchagi, ya'ni
 *     belgi va sahifa bitta g'oyani takrorlaydi;
 *   · markazdagi oltiburchak 30° BURILGAN, shuning uchun har tayanch
 *     uning UCHIGA emas, YON QIRRASIGA tegadi (tayanch uzunligi =
 *     apofema, 0.866·r). Aynan shu detal belgini "yig'ilgan" qiladi;
 *     burilmasa tayanchlar uchlarga tiralib, shakl to'zg'igan ko'rinardi.
 *
 * GRADIENT ID: bitta sahifada belgi bir necha marta uchraydi (navbar,
 * footer, auth). ID'lar takrorlanmasligi uchun `id` prop bilan ajratiladi.
 */

const NODE_R = 13.5;
const NODE_SIZE = 4.2;
const CORE_R = 7.2;
/** Oltiburchakning apofemasi — tayanch shu yergacha boradi. */
const APOTHEM = CORE_R * Math.cos(Math.PI / 6);
const C = 20;

/** Tugun burchaklari (gradus): tepadan boshlab, soat mili bo'yicha. */
const NODE_ANGLES = [-90, -30, 30, 90, 150, 210];

const pt = (angleDeg: number, r: number) => {
  const a = (angleDeg * Math.PI) / 180;
  return [C + Math.cos(a) * r, C + Math.sin(a) * r] as const;
};

const nodes = NODE_ANGLES.map((a) => pt(a, NODE_R));
const spokeEnds = NODE_ANGLES.map((a) => pt(a, APOTHEM));
// Markazdagi oltiburchak 30° burilgan (0°, 60°, 120° ...)
const core = [0, 60, 120, 180, 240, 300].map((a) => pt(a, CORE_R));

export function AgentNetMark({
  size = 32,
  id = "an",
  className = "",
}: {
  size?: number;
  /** Gradient ID prefiksi — bitta sahifadagi nusxalar to'qnashmasin. */
  id?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-label="AgentNet"
      className={className}
    >
      <defs>
        <linearGradient id={`${id}-strut`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(212 100% 78%)" />
          <stop offset="55%" stopColor="hsl(248 100% 74%)" />
          <stop offset="100%" stopColor="hsl(266 100% 66%)" />
        </linearGradient>
        <radialGradient id={`${id}-node`} cx="35%" cy="28%" r="75%">
          <stop offset="0%" stopColor="hsl(215 100% 88%)" />
          <stop offset="45%" stopColor="hsl(248 95% 66%)" />
          <stop offset="100%" stopColor="hsl(258 90% 38%)" />
        </radialGradient>
        <radialGradient id={`${id}-core`} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="hsl(255 100% 76%)" />
          <stop offset="60%" stopColor="hsl(252 95% 56%)" />
          <stop offset="100%" stopColor="hsl(256 90% 34%)" />
        </radialGradient>
      </defs>

      {/* Ramka — tugunlarni bog'lovchi oltiburchak */}
      <polygon
        points={nodes.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}
        stroke={`url(#${id}-strut)`}
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill="none"
        opacity="0.85"
      />

      {/* Tayanchlar — tugundan markaziy oltiburchakning qirrasigacha */}
      {nodes.map(([x, y], i) => (
        <line
          key={i}
          x1={x.toFixed(2)}
          y1={y.toFixed(2)}
          x2={spokeEnds[i][0].toFixed(2)}
          y2={spokeEnds[i][1].toFixed(2)}
          stroke={`url(#${id}-strut)`}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      ))}

      {/* Markaz */}
      <polygon
        points={core.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}
        fill={`url(#${id}-core)`}
        stroke="hsl(220 100% 88%)"
        strokeWidth="0.9"
        strokeLinejoin="round"
        strokeOpacity="0.55"
      />

      {/* Tugunlar — ramkaning ustida */}
      {nodes.map(([x, y], i) => (
        <circle
          key={i}
          cx={x.toFixed(2)}
          cy={y.toFixed(2)}
          r={NODE_SIZE}
          fill={`url(#${id}-node)`}
          stroke="hsl(215 100% 90%)"
          strokeWidth="0.9"
          strokeOpacity="0.6"
        />
      ))}
    </svg>
  );
}
