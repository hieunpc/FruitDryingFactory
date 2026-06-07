interface CircularGaugeProps {
  value: number;
  max: number;
  label: string;
  unit: string;
  color: string;
  trackColor: string;
  icon: React.ReactNode;
  size?: number;
  status?: string;
  statusColor?: string;
}

export function CircularGauge({
  value,
  max,
  label,
  unit,
  color,
  trackColor,
  icon,
  size = 130,
  status,
  statusColor,
}: CircularGaugeProps) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / max, 1);
  // Only fill 270 degrees (¾ of the circle)
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - percentage * arcLength;
  // Rotate so the gap is at the bottom center
  const rotation = 135;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ overflow: "visible" }}>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={10}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          />
          {/* Value arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        {/* Center content */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ paddingBottom: "8px" }}
        >
          <span style={{ color, marginBottom: "2px" }}>{icon}</span>
          <span className="text-slate-800" style={{ fontSize: "1.375rem", fontWeight: 800, lineHeight: 1 }}>
            {value}
          </span>
          <span className="text-slate-500" style={{ fontSize: "0.7rem", fontWeight: 500 }}>
            {unit}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-slate-700" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
          {label}
        </p>
        {status && (
          <span
            className="inline-block px-2 py-0.5 rounded-full mt-0.5"
            style={{
              fontSize: "0.68rem",
              fontWeight: 600,
              background: `${statusColor}20`,
              color: statusColor,
            }}
          >
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
