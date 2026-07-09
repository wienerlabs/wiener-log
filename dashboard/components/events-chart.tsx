"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DayPoint } from "@/lib/db";

export function EventsChart({ data }: { data: DayPoint[] }) {
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="gGithub" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0071e3" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#0071e3" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gGit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a1a1aa" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#a1a1aa" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gCc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7b3fbf" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#7b3fbf" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            tickFormatter={(d: string) =>
              new Date(d).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: "#ececec", strokeWidth: 1 }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #ececec",
              boxShadow: "0 8px 24px -12px rgba(0,0,0,0.2)",
              fontSize: 12,
              padding: "8px 12px",
            }}
            labelFormatter={(d) =>
              new Date(d as string).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })
            }
          />
          <Area
            type="monotone"
            dataKey="github"
            stroke="#0071e3"
            strokeWidth={2}
            fill="url(#gGithub)"
          />
          <Area
            type="monotone"
            dataKey="git"
            stroke="#a1a1aa"
            strokeWidth={1.5}
            fill="url(#gGit)"
          />
          <Area
            type="monotone"
            dataKey="claude_code"
            stroke="#7b3fbf"
            strokeWidth={1.5}
            fill="url(#gCc)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
