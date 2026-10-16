// Yemot IVR weather endpoint using Open-Meteo (no API key required).
// Pass the town as ?town=ירושלים. If town is absent, Yemot is asked to collect it.
const BASE_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
};

function clean(value) {
  return String(value || "").trim().replace(/[<>\r\n]/g, "").slice(0, 80);
}

const TOWNS = [
  "ירושלים",
  "בני ברק",
  "מודיעין עילית",
  "ביתר עילית",
  "אלעד",
  "בית שמש",
  "רכסים",
  "קריית יערים",
  "עמנואל",
  "אשדוד",
  "נתיבות",
  "אופקים",
  "ערד",
  "טבריה",
  "צפת",
  "פתח תקווה",
  "רחובות",
  "חיפה",
  "תל ציון",
  "אחיסמך",
  "תפרח",
  "קוממיות",
  "יסודות",
  "יד בנימין",
  "חפץ חיים",
  "כפר חב״ד",
  "חצור הגלילית"
];

function townMenu() {
  const choices = TOWNS.map((town, index) => `${String(index + 1).padStart(2, "0")} ${town}`).join(". ");
  return `read=t-לבחירת יישוב, הקישו את המספר שלו בין אחת לשתיים ספרות וסיימו בסולמית. ${choices}=town_choice,no,1,2,7,Digits,no,no,,,1,Ok`;
}

function say(text) {
  return `read=t-${text}`;
}

function weatherDescription(code) {
  if (code === 0) return "בהיר";
  if ([1, 2].includes(code)) return "מעונן חלקית";
  if (code === 3) return "מעונן";
  if ([45, 48].includes(code)) return "ערפל";
  if ([51, 53, 55, 56, 57].includes(code)) return "טפטוף";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "גשם";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "שלג";
  if ([95, 96, 99].includes(code)) return "סופת רעמים";
  return "תנאי מזג אוויר משתנים";
}

async function getJson(url) {
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("Upstream weather service failed");
  return response.json();
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", BASE_HEADERS["Content-Type"]);
  res.setHeader("Cache-Control", BASE_HEADERS["Cache-Control"]);

  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end(say("השירות תומך בבקשת GET בלבד"));
  }

  const url = new URL(req.url, "https://example.invalid");
  // Accept common parameter names so the endpoint can be connected flexibly in Yemot.
  let town = clean(url.searchParams.get("town") || url.searchParams.get("city"));
  const choice = clean(url.searchParams.get("town_choice") || url.searchParams.get("wm_nav") || url.searchParams.get("ApiPhoneInput") || url.searchParams.get("val"));

  if (!town && /^\\d{1,2}$/.test(choice)) {
    const index = Number(choice) - 1;
    if (index >= 0 && index < TOWNS.length) town = TOWNS[index];
    else {
      res.statusCode = 200;
      return res.end(say("הבחירה אינה תקינה. נסו שוב"));
    }
  }

  if (!town) {
    res.statusCode = 200;
    return res.end(townMenu());
  }

  try {
    const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geoUrl.searchParams.set("name", town);
    geoUrl.searchParams.set("count", "5");
    geoUrl.searchParams.set("language", "he");
    geoUrl.searchParams.set("format", "json");
    const geo = await getJson(geoUrl.toString());
    const place = geo.results?.[0];
    if (!place) {
      res.statusCode = 200;
      return res.end(say("לא נמצא יישוב בשם שהוקש. נסו שוב"));
    }

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(place.latitude));
    forecastUrl.searchParams.set("longitude", String(place.longitude));
    forecastUrl.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m");
    forecastUrl.searchParams.set("timezone", "Asia/Jerusalem");
    const forecast = await getJson(forecastUrl.toString());
    const current = forecast.current;
    if (!current) throw new Error("Missing current weather");

    const placeName = clean(place.name || town);
    const temperature = Math.round(Number(current.temperature_2m));
    const feelsLike = Math.round(Number(current.apparent_temperature));
    const wind = Math.round(Number(current.wind_speed_10m));
    const humidity = Math.round(Number(current.relative_humidity_2m));
    const condition = weatherDescription(Number(current.weather_code));
    const rain = Number(current.precipitation || 0);
    const message = `מזג האוויר ב${placeName}. כעת ${condition}. הטמפרטורה ${temperature} מעלות. מרגיש כמו ${feelsLike} מעלות. מהירות הרוח ${wind} קילומטר לשעה. הלחות ${humidity} אחוזים. משקעים כעת ${rain} מילימטרים`;
    res.statusCode = 200;
    return res.end(say(message));
  } catch (error) {
    res.statusCode = 200;
    return res.end(say("אירעה תקלה בקבלת נתוני מזג האוויר. נסו שוב מאוחר יותר"));
  }
}
