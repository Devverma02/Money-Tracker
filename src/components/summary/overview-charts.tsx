"use client";

import { useEffect, useState, useTransition } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { formatCompactMoney } from "@/lib/settings/currency";
import type { CurrencyCodeValue } from "@/lib/settings/settings-contract";

type DailyData = { day: string; expense: number; income: number };
type CategoryData = { category: string; amount: number };
type MonthlyData = { month: string; expense: number; income: number };

type ChartData = {
  dailySpending: DailyData[];
  categoryBreakdown: CategoryData[];
  monthlyTrend: MonthlyData[];
};

type TooltipValue =
  | number
  | string
  | ReadonlyArray<number | string>
  | undefined;
type PieLabelLike = {
  name?: string;
  percent?: number;
  payload?: {
    category?: string;
  };
};

const PIE_COLORS = [
  "#0d9488",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#3b82f6",
  "#ec4899",
];

function formatTooltipValue(value: TooltipValue, currency: CurrencyCodeValue) {
  const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
  return formatCompactMoney(Number.isFinite(numericValue) ? numericValue : 0, currency);
}

function renderPieLabel(props: PieLabelLike) {
  const category = props.name ?? props.payload?.category;

  if (!category || typeof props.percent !== "number") {
    return "";
  }

  return `${category} ${Math.round(props.percent * 100)}%`;
}

export function OverviewCharts({
  timezone,
  currency,
}: {
  timezone: string;
  currency: CurrencyCodeValue;
}) {
  const [data, setData] = useState<ChartData | null>(null);
  const [isLoading, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/charts?tz=${encodeURIComponent(timezone)}`);

        if (response.ok) {
          const chartData = (await response.json()) as ChartData;
          setData(chartData);
        }
      } catch {
        // Charts are non-critical; keep the overview usable.
      }
    });
  }, [timezone]);

  if (isLoading || !data) {
    return (
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="flex h-[280px] items-center justify-center rounded-xl border border-gray-200 bg-white"
          >
            <p className="text-sm text-gray-400">Loading chart...</p>
          </div>
        ))}
      </div>
    );
  }

  const hasDailyData = data.dailySpending.some(
    (item) => item.expense > 0 || item.income > 0,
  );
  const hasCategoryData = data.categoryBreakdown.length > 0;
  const hasMonthlyData = data.monthlyTrend.some(
    (item) => item.expense > 0 || item.income > 0,
  );

  if (!hasDailyData && !hasCategoryData && !hasMonthlyData) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
        <p className="text-sm text-gray-500">
          Charts will appear once you have some entries saved.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">Daily spending (7 days)</h3>
        <p className="mt-0.5 text-xs text-gray-400">Expense vs Income</p>
        <div className="mt-3 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.dailySpending} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value) => formatCompactMoney(Number(value), currency)}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                formatter={(value) => formatTooltipValue(value, currency)}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="expense"
                name="Expense"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                dataKey="income"
                name="Income"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">Category breakdown</h3>
        <p className="mt-0.5 text-xs text-gray-400">This month&apos;s expenses</p>
        <div className="mt-3 h-[220px]">
          {hasCategoryData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.categoryBreakdown}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={40}
                  paddingAngle={2}
                  label={renderPieLabel}
                  labelLine={false}
                  style={{ fontSize: 11 }}
                >
                  {data.categoryBreakdown.map((_, index) => (
                    <Cell
                      key={index}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatTooltipValue(value, currency)}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-400">No expenses this month</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">Income vs Expense</h3>
        <p className="mt-0.5 text-xs text-gray-400">Last 4 months trend</p>
        <div className="mt-3 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value) => formatCompactMoney(Number(value), currency)}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                formatter={(value) => formatTooltipValue(value, currency)}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="income"
                name="Income"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4, fill: "#10b981" }}
              />
              <Line
                type="monotone"
                dataKey="expense"
                name="Expense"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 4, fill: "#ef4444" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
