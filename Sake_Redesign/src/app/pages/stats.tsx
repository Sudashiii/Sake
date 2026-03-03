import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Flame,
  Clock,
  TrendingUp,
  Calendar,
  BarChart3,
  Zap,
  Trophy,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { statsData, type DailyReading } from '../lib/stats-data';
import { mockBooks } from '../lib/mock-data';

// ─── Color Palette ──────────────────────────────────────────────
const GOLD = '#c9a962';
const GOLD_DIM = '#5a4a2a';
const GREEN = '#4ade80';
const BLUE = '#60a5fa';
const PURPLE = '#c084fc';
const RED = '#f87171';
const MUTED = '#3a3d4a';
const CARD_BG = '#1a1d27';
const GRID_COLOR = 'rgba(255,255,255,0.04)';

// ─── Heatmap color scale ────────────────────────────────────────
function getHeatColor(pages: number, maxPages: number): string {
  if (pages === 0) return '#1e2230';
  const ratio = pages / maxPages;
  if (ratio < 0.15) return '#2a2518';
  if (ratio < 0.3) return '#3d3520';
  if (ratio < 0.5) return '#5a4a2a';
  if (ratio < 0.7) return '#8a7540';
  return '#c9a962';
}

const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Custom Tooltip ─────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#1a1d27] border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color || GOLD }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
}

// ─── Contribution Heatmap Component ─────────────────────────────
function ReadingHeatmap({ data }: { data: DailyReading[] }) {
  const [tooltipData, setTooltipData] = useState<{ date: string; pages: number; x: number; y: number } | null>(null);

  const { weeks, maxPages, monthLabels } = useMemo(() => {
    // Get last 52 weeks of data
    const endDate = new Date('2026-02-28');
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 363); // ~52 weeks

    // Adjust start to Monday
    while (startDate.getDay() !== 1) {
      startDate.setDate(startDate.getDate() - 1);
    }

    const dateMap = new Map(data.map((d) => [d.date, d.pagesRead]));
    const weeksArr: { date: string; pages: number; dayOfWeek: number }[][] = [];
    let currentWeek: { date: string; pages: number; dayOfWeek: number }[] = [];
    let maxP = 0;
    const monthLabelPositions: { label: string; col: number }[] = [];
    let lastMonth = -1;

    const cursor = new Date(startDate);
    let weekIdx = 0;

    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().split('T')[0];
      const dayOfWeek = cursor.getDay();
      // Convert Sun=0..Sat=6 to Mon=0..Sun=6
      const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const pages = dateMap.get(dateStr) || 0;
      if (pages > maxP) maxP = pages;

      currentWeek.push({ date: dateStr, pages, dayOfWeek: adjustedDay });

      // Track month labels
      const m = cursor.getMonth();
      if (m !== lastMonth) {
        monthLabelPositions.push({ label: MONTHS_SHORT[m], col: weekIdx });
        lastMonth = m;
      }

      if (adjustedDay === 6) {
        weeksArr.push(currentWeek);
        currentWeek = [];
        weekIdx++;
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeksArr.push(currentWeek);
    }

    return { weeks: weeksArr, maxPages: maxP, monthLabels: monthLabelPositions };
  }, [data]);

  const cellSize = 13;
  const cellGap = 3;
  const labelWidth = 28;
  const topPadding = 20;

  return (
    <div className="relative">
      {/* Month labels */}
      <div className="flex ml-[28px]" style={{ gap: 0 }}>
        {monthLabels.map((m, i) => (
          <span
            key={`${m.label}-${i}`}
            className="text-[10px] text-muted-foreground absolute"
            style={{ left: labelWidth + m.col * (cellSize + cellGap), top: 0 }}
          >
            {m.label}
          </span>
        ))}
      </div>

      <div className="flex items-start mt-1" style={{ paddingTop: topPadding }}>
        {/* Day labels */}
        <div className="shrink-0" style={{ width: labelWidth }}>
          {DAYS.map((day, i) => (
            <div
              key={i}
              className="text-[10px] text-muted-foreground"
              style={{ height: cellSize + cellGap, lineHeight: `${cellSize + cellGap}px` }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex overflow-x-auto" style={{ gap: cellGap }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col" style={{ gap: cellGap }}>
              {Array.from({ length: 7 }, (_, di) => {
                const cell = week.find((c) => c.dayOfWeek === di);
                if (!cell) {
                  return (
                    <div
                      key={di}
                      style={{ width: cellSize, height: cellSize }}
                    />
                  );
                }
                return (
                  <div
                    key={di}
                    className="rounded-[3px] cursor-pointer transition-all hover:ring-1 hover:ring-white/20"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: getHeatColor(cell.pages, maxPages),
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltipData({
                        date: cell.date,
                        pages: cell.pages,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setTooltipData(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 0.15, 0.3, 0.5, 0.7, 1].map((ratio, i) => (
          <div
            key={i}
            className="rounded-[2px]"
            style={{
              width: 11,
              height: 11,
              backgroundColor: ratio === 0 ? '#1e2230' : getHeatColor(maxPages * ratio, maxPages),
            }}
          />
        ))}
        <span>More</span>
      </div>

      {/* Floating tooltip */}
      {tooltipData && (
        <div
          className="fixed z-50 bg-[#1a1d27] border border-border rounded-lg px-3 py-2 shadow-xl pointer-events-none"
          style={{
            left: tooltipData.x,
            top: tooltipData.y - 50,
            transform: 'translateX(-50%)',
          }}
        >
          <p className="text-xs text-muted-foreground">
            {new Date(tooltipData.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <p className="text-sm text-foreground">
            {tooltipData.pages > 0
              ? `${tooltipData.pages} pages`
              : 'No reading'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Stats Page ─────────────────────────────────────────────────
export function StatsPage() {
  const { daily, hourly, weekly, monthly, streak, totals } = statsData;
  const [dailyRange, setDailyRange] = useState<'7' | '14' | '30'>('30');

  // ─── Derived data ──────────────────────────
  const recentDaily = useMemo(() => {
    const days = parseInt(dailyRange);
    return daily.slice(-days).map((d) => ({
      ...d,
      label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  }, [daily, dailyRange]);

  const booksByFormat = useMemo(() => {
    const counts: Record<string, number> = {};
    mockBooks.forEach((b) => {
      counts[b.format] = (counts[b.format] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);

  const booksByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    mockBooks.forEach((b) => {
      counts[b.status] = (counts[b.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, []);

  const ratingDist = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0]; // 0–5 stars
    mockBooks.forEach((b) => {
      counts[b.rating]++;
    });
    return counts.slice(1).map((count, i) => ({
      rating: `${i + 1}★`,
      count,
    }));
  }, []);

  const recentWeekly = weekly.slice(-12);

  const totalHours = Math.round(totals.totalMinutes / 60);
  const readingPercentage = Math.round((totals.daysActive / totals.totalDays) * 100);

  const FORMAT_COLORS = [BLUE, PURPLE, GOLD, GREEN, RED];
  const STATUS_COLORS = [MUTED, GOLD, GREEN];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            icon: BookOpen,
            label: 'Total Pages Read',
            value: totals.totalPages.toLocaleString(),
            sub: `${totals.avgPagesPerDay} avg/day`,
            color: 'text-foreground',
            iconColor: GOLD,
          },
          {
            icon: Clock,
            label: 'Reading Time',
            value: `${totalHours}h`,
            sub: `${Math.round(totalHours / Math.max(1, totals.daysActive) * 60)}min avg/session`,
            color: 'text-[#60a5fa]',
            iconColor: BLUE,
          },
          {
            icon: Flame,
            label: 'Current Streak',
            value: `${streak.current} days`,
            sub: `Longest: ${streak.longest} days`,
            color: 'text-[#f87171]',
            iconColor: RED,
          },
          {
            icon: TrendingUp,
            label: 'Days Active',
            value: `${totals.daysActive}`,
            sub: `${readingPercentage}% of days`,
            color: 'text-[#4ade80]',
            iconColor: GREEN,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: card.iconColor + '15' }}
              >
                <card.icon className="w-3.5 h-3.5" style={{ color: card.iconColor }} />
              </div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
            <p className={`text-2xl ${card.color}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Highlight cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#c9a962]/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-[#c9a962]" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Best Reading Day</p>
            <p className="text-sm text-foreground">{totals.bestDay.pagesRead} pages</p>
            <p className="text-xs text-muted-foreground">
              {new Date(totals.bestDay.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4ade80]/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#4ade80]" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg on Active Days</p>
            <p className="text-sm text-foreground">{totals.avgPagesOnActiveDay} pages</p>
            <p className="text-xs text-muted-foreground">{totals.totalSessions} total sessions</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#c084fc]/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-[#c084fc]" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Books in Library</p>
            <p className="text-sm text-foreground">{mockBooks.length} books</p>
            <p className="text-xs text-muted-foreground">
              {mockBooks.filter((b) => b.status === 'read').length} completed
            </p>
          </div>
        </div>
      </div>

      {/* Contribution Heatmap */}
      <div className="bg-card border border-border rounded-xl p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h3>Reading Activity</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {totals.totalPages.toLocaleString()} pages in the last year
          </p>
        </div>
        <div className="overflow-x-auto">
          <ReadingHeatmap data={daily} />
        </div>
      </div>

      {/* Daily Pages Chart */}
      <div className="bg-card border border-border rounded-xl p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Pages Per Day
          </h3>
          <div className="flex items-center bg-secondary rounded-lg p-0.5">
            {(['7', '14', '30'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDailyRange(r)}
                className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                  dailyRange === r
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={recentDaily} barSize={dailyRange === '7' ? 28 : dailyRange === '14' ? 18 : 8}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
                interval={dailyRange === '30' ? 4 : dailyRange === '14' ? 1 : 0}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={35}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="pagesRead" name="Pages" fill={GOLD} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <div className="bg-card border border-border rounded-xl p-4 lg:p-6">
          <h3 className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            Weekly Trend
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={recentWeekly}>
                <defs>
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: GRID_COLOR }}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="pages"
                  name="Pages"
                  stroke={GOLD}
                  fill="url(#goldGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reading by Hour */}
        <div className="bg-card border border-border rounded-xl p-4 lg:p-6">
          <h3 className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-primary" />
            Reading by Time of Day
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#6b7280', fontSize: 9 }}
                  tickLine={false}
                  axisLine={{ stroke: GRID_COLOR }}
                  interval={2}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pages" name="Pages" fill={BLUE} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Pages */}
        <div className="bg-card border border-border rounded-xl p-4 lg:p-6 lg:col-span-2">
          <h3 className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-primary" />
            Monthly Overview
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: GRID_COLOR }}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pages" name="Pages" fill={GOLD} radius={[3, 3, 0, 0]} />
                <Bar dataKey="booksFinished" name="Books Finished" fill={GREEN} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Monthly table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-4">Month</th>
                  <th className="text-right py-2 px-3">Pages</th>
                  <th className="text-right py-2 px-3">Avg/Day</th>
                  <th className="text-right py-2 pl-3">Books Done</th>
                </tr>
              </thead>
              <tbody>
                {monthly.slice(-6).reverse().map((m) => (
                  <tr key={m.month} className="border-b border-border/30">
                    <td className="py-2 pr-4 text-foreground">{m.month}</td>
                    <td className="py-2 px-3 text-right text-secondary-foreground">{m.pages.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-secondary-foreground">{m.avgPagesPerDay}</td>
                    <td className="py-2 pl-3 text-right">
                      {m.booksFinished > 0 ? (
                        <span className="text-[#4ade80]">{m.booksFinished}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distribution Charts */}
        <div className="space-y-6">
          {/* Format Distribution */}
          <div className="bg-card border border-border rounded-xl p-4 lg:p-6">
            <h3 className="text-sm mb-3">Books by Format</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={booksByFormat}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {booksByFormat.map((_, i) => (
                      <Cell key={i} fill={FORMAT_COLORS[i % FORMAT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {booksByFormat.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: FORMAT_COLORS[i % FORMAT_COLORS.length] }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {entry.name} ({entry.value})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Rating Distribution */}
          <div className="bg-card border border-border rounded-xl p-4 lg:p-6">
            <h3 className="text-sm mb-3">Rating Distribution</h3>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingDist} barSize={24}>
                  <XAxis
                    dataKey="rating"
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Books" fill={GOLD} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Distribution */}
          <div className="bg-card border border-border rounded-xl p-4 lg:p-6">
            <h3 className="text-sm mb-3">Books by Status</h3>
            <div className="space-y-2">
              {booksByStatus.map((entry, i) => {
                const total = mockBooks.length;
                const pct = Math.round((entry.value / total) * 100);
                return (
                  <div key={entry.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{entry.name}</span>
                      <span className="text-xs text-foreground">{entry.value} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-[#1e2230] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: STATUS_COLORS[i % STATUS_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Streak Details */}
      <div className="bg-card border border-border rounded-xl p-4 lg:p-6">
        <h3 className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-[#f87171]" />
          Reading Streaks
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-secondary/30 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Current Streak</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl text-foreground">{streak.current}</span>
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <div className="flex items-center gap-1 mt-2">
              {Array.from({ length: Math.min(streak.current, 14) }, (_, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: `rgba(248,113,113,${0.3 + (i / Math.min(streak.current, 14)) * 0.7})`,
                  }}
                />
              ))}
              {streak.current > 14 && (
                <span className="text-xs text-muted-foreground ml-1">+{streak.current - 14}</span>
              )}
            </div>
          </div>
          <div className="bg-secondary/30 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Longest Streak</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl text-foreground">{streak.longest}</span>
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {new Date(streak.longestStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' — '}
              {new Date(streak.longestEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
