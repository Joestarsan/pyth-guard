type TimelineStripProps = {
  values: number[];
};

export function TimelineStrip({ values }: TimelineStripProps) {
  const max = Math.max(...values);
  const min = Math.min(...values);

  return (
    <div className="timelineStrip" aria-label="Trust score timeline">
      {values.map((value, index) => {
        const height = ((value - min) / Math.max(max - min, 1)) * 100;
        return (
          <div key={`${value}-${index}`} className="timelineBarWrap">
            <span className="timelineValue">{value}</span>
            <div
              className="timelineBar"
              style={{ height: `${Math.max(height, 12)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
