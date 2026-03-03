// ─── Synthetic reading stats data ────────────────────────────────
// Generates realistic daily reading data for the past year

export interface DailyReading {
  date: string; // YYYY-MM-DD
  pagesRead: number;
  minutesRead: number;
  sessions: number;
}

export interface HourlyReading {
  hour: number; // 0–23
  label: string;
  pages: number;
  sessions: number;
}

export interface WeeklyReading {
  week: string; // e.g. "Jan 6"
  weekStart: string;
  pages: number;
  minutes: number;
  books: number;
}

export interface MonthlyReading {
  month: string;
  pages: number;
  booksFinished: number;
  avgPagesPerDay: number;
}

export interface ReadingStreak {
  current: number;
  longest: number;
  longestStart: string;
  longestEnd: string;
}

// Seeded pseudo-random for reproducibility
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

function generateDailyData(): DailyReading[] {
  const data: DailyReading[] = [];
  const today = new Date('2026-02-28');
  const start = new Date('2025-03-01');

  const current = new Date(start);
  while (current <= today) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Base probability of reading on any given day
    let readProb = isWeekend ? 0.75 : 0.55;

    // Seasonal variation: read more in winter months
    const month = current.getMonth();
    if (month >= 10 || month <= 1) readProb += 0.1;
    if (month >= 5 && month <= 7) readProb -= 0.1;

    const didRead = rand() < readProb;

    if (didRead) {
      const basePagesWeekday = 15 + Math.floor(rand() * 30);
      const basePagesWeekend = 25 + Math.floor(rand() * 50);
      const pages = isWeekend ? basePagesWeekend : basePagesWeekday;

      // Occasionally have big reading sessions
      const bigSession = rand() < 0.08;
      const finalPages = bigSession ? pages + 40 + Math.floor(rand() * 60) : pages;

      const minutesPerPage = 1.5 + rand() * 1.5;
      const minutes = Math.round(finalPages * minutesPerPage);
      const sessions = 1 + (rand() < 0.3 ? 1 : 0) + (bigSession ? 1 : 0);

      data.push({
        date: current.toISOString().split('T')[0],
        pagesRead: finalPages,
        minutesRead: minutes,
        sessions,
      });
    } else {
      data.push({
        date: current.toISOString().split('T')[0],
        pagesRead: 0,
        minutesRead: 0,
        sessions: 0,
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return data;
}

function generateHourlyData(dailyData: DailyReading[]): HourlyReading[] {
  const hours: HourlyReading[] = [];
  // Simulate reading distribution by hour
  const hourWeights = [
    0.02, 0.01, 0.005, 0.002, 0.002, 0.01, // 0–5 AM
    0.03, 0.06, 0.08, 0.05, 0.04, 0.03,      // 6–11 AM
    0.04, 0.05, 0.04, 0.03, 0.04, 0.05,       // 12–5 PM
    0.06, 0.08, 0.12, 0.14, 0.10, 0.06,       // 6–11 PM
  ];

  const totalPages = dailyData.reduce((s, d) => s + d.pagesRead, 0);
  const totalSessions = dailyData.reduce((s, d) => s + d.sessions, 0);

  for (let h = 0; h < 24; h++) {
    const amPm = h < 12 ? 'AM' : 'PM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    hours.push({
      hour: h,
      label: `${displayHour}${amPm}`,
      pages: Math.round(totalPages * hourWeights[h]),
      sessions: Math.round(totalSessions * hourWeights[h]),
    });
  }

  return hours;
}

function generateWeeklyData(dailyData: DailyReading[]): WeeklyReading[] {
  const weeks: WeeklyReading[] = [];
  let currentWeek: DailyReading[] = [];
  let weekStart = '';

  for (let i = 0; i < dailyData.length; i++) {
    const d = new Date(dailyData[i].date);
    const dayOfWeek = d.getDay();

    if (dayOfWeek === 1 && currentWeek.length > 0) {
      // New week starts on Monday
      const totalPages = currentWeek.reduce((s, x) => s + x.pagesRead, 0);
      const totalMin = currentWeek.reduce((s, x) => s + x.minutesRead, 0);
      const ws = new Date(weekStart);
      weeks.push({
        week: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weekStart,
        pages: totalPages,
        minutes: totalMin,
        books: rand() < 0.15 ? 1 : 0,
      });
      currentWeek = [];
    }

    if (currentWeek.length === 0) weekStart = dailyData[i].date;
    currentWeek.push(dailyData[i]);
  }

  // Last partial week
  if (currentWeek.length > 0) {
    const totalPages = currentWeek.reduce((s, x) => s + x.pagesRead, 0);
    const totalMin = currentWeek.reduce((s, x) => s + x.minutesRead, 0);
    const ws = new Date(weekStart);
    weeks.push({
      week: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weekStart,
      pages: totalPages,
      minutes: totalMin,
      books: 0,
    });
  }

  return weeks;
}

function generateMonthlyData(dailyData: DailyReading[]): MonthlyReading[] {
  const months: Record<string, { pages: number; days: number; booksFinished: number }> = {};

  for (const day of dailyData) {
    const d = new Date(day.date);
    const key = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    if (!months[key]) months[key] = { pages: 0, days: 0, booksFinished: 0 };
    months[key].pages += day.pagesRead;
    months[key].days++;
  }

  // Sprinkle in some completed books
  const bookCompletionMonths = ['Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Sep 2025', 'Jul 2025'];
  for (const m of bookCompletionMonths) {
    if (months[m]) months[m].booksFinished = 1 + (rand() < 0.3 ? 1 : 0);
  }

  return Object.entries(months).map(([month, data]) => ({
    month,
    pages: data.pages,
    booksFinished: data.booksFinished,
    avgPagesPerDay: Math.round(data.pages / data.days),
  }));
}

function calculateStreak(dailyData: DailyReading[]): ReadingStreak {
  let current = 0;
  let longest = 0;
  let longestStart = '';
  let longestEnd = '';
  let tempStart = '';
  let tempLen = 0;

  for (let i = dailyData.length - 1; i >= 0; i--) {
    if (dailyData[i].pagesRead > 0) {
      if (current === 0 || i === dailyData.length - 1 - current) {
        current++;
      }
    } else if (current > 0 && i === dailyData.length - 1 - current) {
      break;
    } else {
      break;
    }
  }

  // Calculate longest streak forward
  for (let i = 0; i < dailyData.length; i++) {
    if (dailyData[i].pagesRead > 0) {
      if (tempLen === 0) tempStart = dailyData[i].date;
      tempLen++;
      if (tempLen > longest) {
        longest = tempLen;
        longestStart = tempStart;
        longestEnd = dailyData[i].date;
      }
    } else {
      tempLen = 0;
    }
  }

  return { current, longest, longestStart, longestEnd };
}

// Generate and export all stats data
const dailyData = generateDailyData();

export const statsData = {
  daily: dailyData,
  hourly: generateHourlyData(dailyData),
  weekly: generateWeeklyData(dailyData),
  monthly: generateMonthlyData(dailyData),
  streak: calculateStreak(dailyData),
  totals: {
    totalPages: dailyData.reduce((s, d) => s + d.pagesRead, 0),
    totalMinutes: dailyData.reduce((s, d) => s + d.minutesRead, 0),
    totalSessions: dailyData.reduce((s, d) => s + d.sessions, 0),
    daysActive: dailyData.filter((d) => d.pagesRead > 0).length,
    totalDays: dailyData.length,
    avgPagesPerDay: Math.round(
      dailyData.reduce((s, d) => s + d.pagesRead, 0) / dailyData.length
    ),
    avgPagesOnActiveDay: Math.round(
      dailyData.reduce((s, d) => s + d.pagesRead, 0) /
        Math.max(1, dailyData.filter((d) => d.pagesRead > 0).length)
    ),
    bestDay: dailyData.reduce(
      (best, d) => (d.pagesRead > best.pagesRead ? d : best),
      dailyData[0]
    ),
  },
};
