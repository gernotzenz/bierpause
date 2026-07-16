// OpenMoji-Emojis (https://openmoji.org, CC BY-SA 4.0)
// Rendert jedes Emoji als SVG vom CDN statt als System-Font.

export default function Emoji({
  e,
  size = 22,
  className = "",
}: {
  e: string;
  size?: number;
  className?: string;
}) {
  const codes = Array.from(e)
    .map((c) => c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0"))
    .filter((c) => c !== "FE0F");
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {codes.map((code, i) => (
        <img
          key={i}
          src={`https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@15.0.0/color/svg/${code}.svg`}
          width={size}
          height={size}
          alt={e}
          loading="lazy"
          className="inline-block"
        />
      ))}
    </span>
  );
}
