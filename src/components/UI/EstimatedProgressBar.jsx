export default function EstimatedProgressBar({
  progress = 0,
  label = '',
  color,
  compact = false,
}) {
  const percentage = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  const fill = color || 'linear-gradient(90deg, var(--tp-from), var(--tp))';

  return (
    <div>
      <div style={{
        background: '#e8e8f0',
        borderRadius: 8,
        height: compact ? 6 : 8,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          borderRadius: 8,
          background: fill,
          width: `${percentage}%`,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: compact ? 6 : 8,
        color: '#9CA3AF',
        fontSize: compact ? 11 : 12,
        lineHeight: 1.5,
      }}>
        <span>{label}</span>
        <span style={{ flexShrink: 0, fontWeight: 700 }}>预计 {percentage}%</span>
      </div>
    </div>
  );
}
