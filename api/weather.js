// שירות מזג אוויר לימות המשיח באמצעות Open-Meteo (ללא מפתח API).
// מעבירים שם יישוב בפרמטר town. אם לא נשלח יישוב, מוחזר תפריט בחירה.
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
  return `read=t-ברוכים הבאים לשירות מזג האוויר. כדי לקבל תחזית מותאמת ליישוב שלכם, בחרו את היישוב מהרשימה והקישו את מספרו, ולאחר מכן סולמית. ${choices}=wm_nav,no,1,2,5,Digits,no,no,,,1,Ok`;
}

function say(text) {
  return `read=t-${text}`;
}

function weatherDescription(code) {
  if (code === 0) return "בהיר";
  if ([1, 2].includes(code)) return "מעונן חלקית";
  if (code === 3) return "מעונן";
  if ([45, 48].includes(code)) return "ערפילי";
  if ([51, 53, 55, 56, 57].includes(code)) return "עם טפטוף";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "גשום";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "עם שלג";
  if ([95, 96, 99].includes(code)) return "עם סופות רעמים";
  return "עם תנאי מזג אוויר משתנים";
}

function clothingAdvice(temperature, feelsLike, wind, rain, code) {
  const advice = [];

  if (feelsLike <= 7 || temperature <= 9) {
    advice.push("קריר עד קר, ולכן מומלץ לצאת עם חולצה ארוכה, סוודר חם ומעיל מתאים");
    if (feelsLike <= 3) advice.push("אם אתם יוצאים לזמן ממושך, כדאי להוסיף גם צעיף");
  } else if (feelsLike <= 14 || temperature <= 16) {
    advice.push("מומלץ ללבוש חולצה ארוכה עם סוודר קל או ז׳קט שאפשר להסיר בהמשך");
  } else if (feelsLike <= 20 || temperature <= 22) {
    advice.push("מזג האוויר נוח יחסית, וחולצה ארוכה קלה או חולצה מכופתרת יתאימו");
  } else if (feelsLike <= 26 || temperature <= 28) {
    advice.push("מזג האוויר נעים עד חמים, ואפשר להסתפק בלבוש קל ונוח");
  } else {
    advice.push("חם למדי, ולכן מומלץ לבחור חולצה קלילה ונושמת ומכנסיים מבד נוח");
  }

  if (wind >= 30) {
    advice.push("נושבת רוח חזקה, ולכן כדאי להוסיף ז׳קט או מעיל רוח");
  } else if (wind >= 18 && feelsLike <= 18) {
    advice.push("יש גם רוח מורגשת, וכדאי לקחת שכבה נוספת");
  }

  if (rain > 0 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) {
    advice.push("מומלץ להצטייד במטרייה ובמעיל גשם, ולבחור נעליים סגורות שמתאימות למזג אוויר רטוב");
  }

  return advice.join(". ") + ".";
}

async function getJson(url) {
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("שירות מזג האוויר אינו זמין");
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
  let town = clean(url.searchParams.get("town") || url.searchParams.get("city"));
  const choice = clean(
    url.searchParams.get("wm_nav") ||
    url.searchParams.get("town_choice") ||
    url.searchParams.get("ApiPhoneInput") ||
    url.searchParams.get("val")
  );

  if (!town && /^\d{1,2}$/.test(choice)) {
    const index = Number(choice) - 1;
    if (index >= 0 && index < TOWNS.length) town = TOWNS[index];
    else {
      res.statusCode = 200;
      return res.end(say("הבחירה שהקשתם אינה מופיעה ברשימה. אנא נסו לבחור שוב"));
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
      return res.end(say("לא הצלחנו למצוא את היישוב שבחרתם. בדקו את הבחירה ונסו שוב"));
    }

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(place.latitude));
    forecastUrl.searchParams.set("longitude", String(place.longitude));
    forecastUrl.searchParams.set(
      "current",
      "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m"
    );
    forecastUrl.searchParams.set("timezone", "Asia/Jerusalem");

    const forecast = await getJson(forecastUrl.toString());
    const current = forecast.current;
    if (!current) throw new Error("נתוני מזג האוויר חסרים");

    const placeName = clean(place.name || town);
    const temperature = Math.round(Number(current.temperature_2m));
    const feelsLike = Math.round(Number(current.apparent_temperature));
    const wind = Math.round(Number(current.wind_speed_10m));
    const humidity = Math.round(Number(current.relative_humidity_2m));
    const conditionCode = Number(current.weather_code);
    const condition = weatherDescription(conditionCode);
    const rain = Number(current.precipitation || 0);
    const advice = clothingAdvice(temperature, feelsLike, wind, rain, conditionCode);

    const openings = [
      "שלום וברוכים הבאים לשירות מזג האוויר.",
      "הנה עדכון מזג האוויר עבורכם.",
      "בדקנו עבורכם את מזג האוויר ביישוב."
    ];
    const opening = openings[new Date().getMinutes() % openings.length];

    const message =
      `${opening} ב${placeName} מזג האוויר כעת ${condition}. ` +
      `הטמפרטורה היא ${temperature} מעלות, והתחושה היא כמו ${feelsLike} מעלות. ` +
      `${advice} ` +
      `מהירות הרוח היא ${wind} קילומטרים בשעה, והלחות עומדת על ${humidity} אחוזים. ` +
      `כמות המשקעים הנמדדת כעת היא ${rain} מילימטרים. ` +
      "כדאי להתעדכן שוב בהמשך היום, כי מזג האוויר עשוי להשתנות. שיהיה לכם יום נעים, מוצלח ובריא!";

    res.statusCode = 200;
    return res.end(say(message));
  } catch (error) {
    res.statusCode = 200;
    return res.end(say("מצטערים, כרגע לא הצלחנו לקבל את נתוני מזג האוויר. אנא נסו שוב בעוד מספר דקות. תודה על הסבלנות"));
  }
}
