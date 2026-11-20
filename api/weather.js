// שירות מזג אוויר לימות המשיח באמצעות Open-Meteo (ללא מפתח API).
// מעבירים שם יישוב בפרמטר town. אם לא נשלח יישוב, מוחזר תפריט בחירה.
const BASE_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
};

function clean(value) {
  return String(value || "").trim().replace(/[<>\r\n]/g, "").slice(0, 80);
}

function cleanPhone(value) {
  const phone = String(value || "").replace(/[^0-9]/g, "");
  return phone.length >= 7 && phone.length <= 15 ? phone : "";
}

async function cityStore(action, phone, town = "") {
  const endpoint = process.env.GOOGLE_SHEETS_WEB_APP_URL;
  const secret = process.env.GOOGLE_SHEETS_SECRET;
  if (!endpoint || !secret || !phone) return null;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, phone, town, secret })
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result && result.ok ? result : null;
  } catch {
    return null;
  }
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
  const rainy = rain > 0 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code);

  if (feelsLike <= 7 || temperature <= 9) {
    advice.push("קר מאוד בחוץ. מומלץ ללבוש חולצה ארוכה או מכופתרת, סוודר חם ומעיל חורף");
    if (feelsLike <= 3) advice.push("כדאי להוסיף גם צעיף וכובע חם, במיוחד אם מתכננים לשהות בחוץ");
  } else if (feelsLike <= 14 || temperature <= 16) {
    advice.push("מומלץ לבחור בחולצה ארוכה, סוודר או קרדיגן, ואפשר להוסיף ז׳קט או מעיל קל");
  } else if (feelsLike <= 20 || temperature <= 22) {
    advice.push("מזג האוויר קריר ונעים. חולצה מכופתרת או חולצה ארוכה עם קרדיגן קל יתאימו");
  } else if (feelsLike <= 26 || temperature <= 28) {
    advice.push("מזג האוויר נעים עד חמים. אפשר לבחור חולצה מכופתרת קלילה או חולצה ארוכה מבד דק, עם מכנסיים ארוכים ונוחים");
  } else {
    advice.push("חם למדי היום. מומלץ לבחור חולצה קלילה ונושמת ומכנסיים ארוכים מבד נוח ואוורירי");
  }

  if (wind >= 30) {
    advice.push("הרוח חזקה, ולכן כדאי להוסיף ז׳קט או מעיל רוח");
  } else if (wind >= 18 && feelsLike <= 18) {
    advice.push("יש רוח מורגשת, וכדאי לקחת שכבה נוספת כמו קרדיגן או ז׳קט");
  }

  if (rainy) {
    advice.push("מומלץ להצטייד במטרייה ובמעיל גשם, ולנעול נעליים סגורות שמתאימות למזג אוויר רטוב");
  } else if (temperature <= 14) {
    advice.push("נעליים סגורות יהיו בחירה טובה למזג האוויר");
  }

  if (temperature <= 18) {
    advice.push("אם אתם יוצאים בלבוש חגיגי או בחליפה, כדאי להתאים גם שכבה חמה מעליה");
  }

  return advice.join(". ") + ".";
}

function dailyIndex() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now - start) / 86400000);
  return day % 30;
}

function dailyWording(index) {
  const openings = [
    "שלום וברוכים הבאים לעדכון מזג האוויר היומי.",
    "בוקר טוב, הנה התחזית המעודכנת עבור היישוב שלכם.",
    "שמחים לעדכן אתכם במזג האוויר הצפוי.",
    "הנה תמונת מזג האוויר העדכנית להיום.",
    "בדקנו עבורכם את תנאי מזג האוויר, והנה מה שכדאי לדעת.",
    "שלום לכם, קבלו את עדכון מזג האוויר המקומי.",
    "התחזית היומית שלכם מוכנה, בואו נשמע מה צפוי.",
    "רגע לפני שיוצאים מהבית, הנה עדכון מזג האוויר.",
    "הנה כמה פרטים שיעזרו לכם להתארגן נכון ליום.",
    "עדכון מזג האוויר של היום מתחיל עכשיו.",
    "בדקנו מה צפוי בחוץ, והנה התחזית עבורכם.",
    "שלום, הנה מזג האוויר העדכני באזורכם.",
    "קבלו תחזית קצרה והמלצה קטנה לפני היציאה.",
    "הנה העדכון היומי שיעזור לכם לבחור מה ללבוש.",
    "מזג האוויר מתעדכן, ואנחנו כאן עם הפרטים החשובים.",
    "הגיע הזמן לבדוק מה מחכה לנו בחוץ היום.",
    "הנה תחזית מזג האוויר, יחד עם המלצה שימושית ליום.",
    "שלום וברכה, אלה תנאי מזג האוויר הצפויים באזורכם.",
    "לפניכם עדכון מקומי על מזג האוויר והלבוש המומלץ.",
    "רוצים לדעת איך להתלבש היום? הנה התחזית.",
    "הנה מה שמזג האוויר מכין לנו להמשך היום.",
    "עדכון קצר, שימושי ומדויק על מזג האוויר באזורכם.",
    "בדקנו את הטמפרטורה, הרוח והגשם. הנה התוצאה.",
    "התחזית להיום מוגשת לכם עם המלצה להתארגנות נוחה.",
    "שלום לכם, בואו נבדוק אם כדאי לקחת שכבה נוספת.",
    "הנה התחזית המקומית שלכם, עם כל מה שחשוב לדעת.",
    "מזג האוויר בחוץ עשוי להשתנות, וכדאי לצאת מוכנים.",
    "קבלו את עדכון היום והמלצה מתאימה ללבוש.",
    "אנחנו כאן כדי לעזור לכם לצאת מהבית מוכנים למזג האוויר.",
    "נסיים את ההמתנה ונעבור לתחזית מזג האוויר שלכם."
  ];
  const endings = [
    "שיהיה לכם יום נעים, מוצלח ובריא!",
    "צאו מוכנים, ושיהיה יום מבורך ונעים!",
    "מאחלים לכם יום טוב ומוצלח בכל אשר תפנו.",
    "שמרו על עצמכם ותיהנו מהיום!",
    "המשך יום נעים ומוצלח לכולם!",
    "שתהיה לכם יציאה נעימה ויום מלא בשורות טובות.",
    "אל תשכחו להתלבש בהתאם, ויום נפלא!",
    "תודה שהאזנתם, ושיהיה לכם יום מצוין.",
    "שיהיה יום נעים, רגוע ומוצלח!",
    "היו מוכנים למזג האוויר, והמשך יום טוב!"
  ];
  return {
    opening: openings[index],
    ending: endings[index % endings.length]
  };
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
  const phone = cleanPhone(url.searchParams.get("ApiPhone"));
  const choice = clean(
    url.searchParams.get("wm_nav") ||
    url.searchParams.get("town_choice") ||
    url.searchParams.get("ApiPhoneInput") ||
    url.searchParams.get("val")
  );

  // בחירה מפורשת של המשתמש גוברת על העיר השמורה.
  if (!town && /^\d{1,2}$/.test(choice)) {
    const index = Number(choice) - 1;
    if (index >= 0 && index < TOWNS.length) {
      town = TOWNS[index];
      if (phone) await cityStore("set", phone, town);
    } else {
      res.statusCode = 200;
      return res.end(say("הבחירה שהקשתם אינה מופיעה ברשימה. אנא נסו לבחור שוב"));
    }
  }

  // אם לא נבחרה עיר בשיחה הנוכחית, ננסה לטעון את העיר המועדפת לפי ApiPhone.
  if (!town && phone) {
    const saved = await cityStore("get", phone);
    if (saved?.town) town = clean(saved.town);
  }

  if (!town) {
    res.statusCode = 200;
    return res.end(townMenu());
  }

  // גם כתובת town/city מפורשת מעדכנת את העיר המועדפת של המתקשר.
  if (phone && !/^\d{1,2}$/.test(choice)) {
    await cityStore("set", phone, town);
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

    const wording = dailyWording(dailyIndex());

    const message =
      `${wording.opening} ב${placeName} מזג האוויר כעת ${condition}. ` +
      `הטמפרטורה היא ${temperature} מעלות, והתחושה בחוץ דומה ל${feelsLike} מעלות. ` +
      `${advice} ` +
      `מהירות הרוח היא ${wind} קילומטרים בשעה, והלחות עומדת על ${humidity} אחוזים. ` +
      `כמות המשקעים הנמדדת כעת היא ${rain} מילימטרים. ` +
      `מומלץ להתעדכן שוב בהמשך היום, משום שהתנאים עשויים להשתנות. ${wording.ending}`;

    res.statusCode = 200;
    return res.end(say(message));
  } catch (error) {
    res.statusCode = 200;
    return res.end(say("מצטערים, כרגע לא הצלחנו לקבל את נתוני מזג האוויר. אנא נסו שוב בעוד מספר דקות. תודה על הסבלנות"));
  }
}
