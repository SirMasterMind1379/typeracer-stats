import {
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  CartesianGrid,
  Legend,
} from "recharts";
import CustomTooltip from "./CustomTooltip";

export interface ChartProps {
  data: any[];
  selectedMetric: "speed" | "accuracy" | "points" | "wins";
  lineColor: string;
  regressionColor: string;
  regression: { slope: number; line: number[] } | null;
  onMouseDown: (e: any) => void;
  onMouseMove: (e: any) => void;
  onMouseUp: () => void;
  refAreaLeft: number | null;
  refAreaRight: number | null;
  formatDate: (d: string) => string;
  yDomain?: { min: number; max: number };
}

export default function Chart({
  data,
  selectedMetric,
  lineColor,
  regressionColor,
  regression,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  refAreaLeft,
  refAreaRight,
  formatDate,
  yDomain,
}: ChartProps) {
  const isWins = selectedMetric === "wins";
  const isPoints = selectedMetric === "points";

  const metricLabel = isWins
    ? "Wins per 100 races"
    : isPoints
    ? "Cumulative Points"
    : selectedMetric === "speed"
    ? "Speed (WPM)"
    : "Accuracy (%)";

  const dataKey = isWins
    ? "winsPer100"
    : isPoints
    ? "cumulativePoints"
    : selectedMetric === "speed"
    ? "speed"
    : "accuracy";

  return (
    <div className="h-72 sm:h-96 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          margin={{ left: 12, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11, angle: -15, textAnchor: "end" }}
            interval="preserveStartEnd"
            height={40}
            padding={{ left: 10 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            domain={yDomain ? [yDomain.min, yDomain.max] : ["auto", "auto"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {isWins ? (
            <Bar dataKey="winsPer100" name="Wins per 100 races" fill="#ff7300" fillOpacity={0.4} radius={[0, 0, 0, 0]} barSize={8} />
          ) : (
            <>
              <Line
                type="monotone"
                dataKey={dataKey}
                name={metricLabel}
                stroke={lineColor}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3 }}
              />
              {regression && !isPoints && (
                <Line
                  type="linear"
                  dataKey="regressionLine"
                  name={`Trend (${regression.slope > 0 ? "+" : ""}${regression.slope.toFixed(4)}/race)`}
                  stroke={regressionColor}
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                  activeDot={false}
                />
              )}
            </>
          )}
          {refAreaLeft && refAreaRight && (
            <ReferenceArea
              x1={formatDate(new Date(Math.min(refAreaLeft, refAreaRight)).toISOString())}
              x2={formatDate(new Date(Math.max(refAreaLeft, refAreaRight)).toISOString())}
              stroke="#8884d8"
              strokeDasharray="4 4"
              fill="#8884d8"
              fillOpacity={0.1}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
