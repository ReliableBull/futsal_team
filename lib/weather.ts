export type WeeklyWeatherItem = {
  day: string;
  dateLabel: string;
  condition: string;
  minTemp: number;
  maxTemp: number;
  precipitationChance: number;
};

export type WeeklyWeather = {
  location: string;
  items: WeeklyWeatherItem[];
  source: "api" | "mock";
};

type OpenWeatherForecastItem = {
  dt_txt: string;
  main: {
    temp_min: number;
    temp_max: number;
  };
  weather: Array<{
    description: string;
  }>;
  pop?: number;
};

type OpenWeatherForecastResponse = {
  list?: OpenWeatherForecastItem[];
};

const mockPattern = [
  { condition: "맑음", minTemp: 12, maxTemp: 22, precipitationChance: 10 },
  { condition: "구름 많음", minTemp: 13, maxTemp: 21, precipitationChance: 20 },
  { condition: "비", minTemp: 14, maxTemp: 19, precipitationChance: 70 },
  { condition: "맑음", minTemp: 11, maxTemp: 23, precipitationChance: 10 },
  { condition: "맑음", minTemp: 12, maxTemp: 24, precipitationChance: 10 },
  { condition: "흐림", minTemp: 15, maxTemp: 22, precipitationChance: 30 },
  { condition: "맑음", minTemp: 13, maxTemp: 25, precipitationChance: 10 },
  { condition: "구름 조금", minTemp: 14, maxTemp: 24, precipitationChance: 20 },
  { condition: "흐림", minTemp: 15, maxTemp: 23, precipitationChance: 40 },
  { condition: "맑음", minTemp: 13, maxTemp: 26, precipitationChance: 10 }
];

const weekdayFormatter = new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: "Asia/Seoul" });
const dateFormatter = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" });

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateLabel(date: Date) {
  return dateFormatter.format(date).replace(/\s/g, "");
}

function formatWeekday(date: Date) {
  return weekdayFormatter.format(date).replace("요일", "");
}

function getTodayInKorea() {
  const koreaDateText = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  return new Date(`${koreaDateText}T00:00:00+09:00`);
}

function createMockItems(startDate = getTodayInKorea()): WeeklyWeatherItem[] {
  return mockPattern.map((item, index) => {
    const date = addDays(startDate, index);

    return {
      day: formatWeekday(date),
      dateLabel: formatDateLabel(date),
      ...item
    };
  });
}

function getMockWeather(): WeeklyWeather {
  return {
    location: "대구",
    items: createMockItems(),
    source: "mock"
  };
}

function toKoreaDate(dateText: string) {
  return new Date(`${dateText.replace(" ", "T")}+09:00`);
}

function mapForecastResponse(data: OpenWeatherForecastResponse): WeeklyWeatherItem[] {
  const daily = new Map<string, WeeklyWeatherItem>();

  for (const item of data.list ?? []) {
    const dateKey = item.dt_txt.slice(0, 10);
    const date = toKoreaDate(item.dt_txt);
    const current = daily.get(dateKey);
    const precipitationChance = Math.round((item.pop ?? 0) * 100);

    if (!current) {
      daily.set(dateKey, {
        day: formatWeekday(date),
        dateLabel: formatDateLabel(date),
        condition: item.weather[0]?.description ?? "정보 없음",
        minTemp: Math.round(item.main.temp_min),
        maxTemp: Math.round(item.main.temp_max),
        precipitationChance
      });
      continue;
    }

    current.minTemp = Math.min(current.minTemp, Math.round(item.main.temp_min));
    current.maxTemp = Math.max(current.maxTemp, Math.round(item.main.temp_max));
    if (precipitationChance >= current.precipitationChance) {
      current.precipitationChance = precipitationChance;
      current.condition = item.weather[0]?.description ?? current.condition;
    }
  }

  const apiItems = Array.from(daily.values());
  const mockItems = createMockItems();
  const apiDateLabels = new Set(apiItems.map((item) => item.dateLabel));
  const fillerItems = mockItems.filter((item) => !apiDateLabels.has(item.dateLabel));

  return [...apiItems, ...fillerItems].slice(0, 10);
}

export async function getWeeklyWeather(): Promise<WeeklyWeather> {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) return getMockWeather();

  try {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=Daegu,KR&appid=${apiKey}&units=metric&lang=kr`, {
      next: { revalidate: 60 * 60 * 3 }
    });

    if (!response.ok) return getMockWeather();

    const data = (await response.json()) as OpenWeatherForecastResponse;
    const items = mapForecastResponse(data);

    return items.length > 0
      ? {
          location: "대구",
          items,
          source: "api"
        }
      : getMockWeather();
  } catch {
    return getMockWeather();
  }
}
