import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  CartesianGrid,
  Legend,
} from "recharts";
import CustomTooltip from "./CustomTooltip";

/**
 * ChartProps — all data and callbacks the chart needs from the parent.
 *
 * @param data             - Array of data points with per-race values, cumulative points, regression line.
 * @param selectedMetric   - Currently active metric (speed / accuracy / points).
 * @param lineColor        - Color for the primary metric line.
 * @param regressionColor  - Color for the dashed regression trend line.
 * @param regression       - Regression result or null (computed in parent).
 * @param onMouseDown      - Callback when user presses mouse on the chart.
 * @param onMouseMove      - Callback when user moves mouse while holding.
 * @param onMouseUp        - Callback when user releases mouse (finalises zoom).
 * @param refAreaLeft      - Left boundary of the zoom selection (timestamp or null).
 * @param refAreaRight     - Right boundary of the zoom selection (timestamp or null).
 * @param formatDate       - Function to format an ISO date string for the reference area.
 */
export interface ChartProps {
  data: any[];
  selectedMetric: "speed" | "accuracy" | "points";
  lineColor: string;
  regressionColor: string;
  regression: { slope: number; line: number[] } | null;
  onMouseDown: (e: any) => void;
  onMouseMove: (e: any) => void;
  onMouseUp: () => void;
  refAreaLeft: number | null;
  refAreaRight: number | null;
  formatDate: (d: string) => string;
}

/**
 * Chart — recharts LineChart showing per-race speed/accuracy,
 * cumulative points, optional wins-per-10 overlay, and a
 * dashed regression trend line.
 */
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
}: ChartProps) {
  const isPoints = selectedMetric === "points";

  const metricLabel = isPoints
    ? "Cumulative Points"
    : selectedMetric === "speed"
    ? "Speed (WPM)"
    : "Accuracy (%)";

  const dataKey = isPoints
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
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            domain={[selectedMetric === "accuracy" ? 80 : "auto", "auto"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey={dataKey}
            name={metricLabel}
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
          />
          {selectedMetric === "speed" && (
            <Line
              type="monotone"
              dataKey="winsPer10"
              name="Wins per 10 races"
              stroke="#ff7300"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          )}
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
