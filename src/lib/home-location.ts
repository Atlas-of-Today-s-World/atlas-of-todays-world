/**
 * Kam otevřít globus, když uživatel přijde na úvodní stránku.
 *
 * Nepoužíváme geolokaci prohlížeče – ta vyskakuje s dotazem na povolení a pro
 * „otevři to u mě doma" je to zbytečně invazivní. Stačí dva signály, které
 * prohlížeč dává sám:
 *   1. časové pásmo (Europe/Prague → Česko) – nejlepší odhad polohy,
 *   2. jazyk (cs-CZ, nebo `cs` rozbalené přes Intl.Locale na CZ),
 *   3. když ani jedno nesedí, střed Evropy.
 */

/** Střed Evropy – výchozí pohled, když se polohu určit nepodaří. */
export const EUROPE_CENTER: [number, number] = [14, 49.5];

/**
 * Přiblížení, při kterém koule vyplní okno. MapLibre má obvod světa
 * 512·2^zoom pixelů, průměr koule je tedy (512·2^zoom)/π – z toho zpětně
 * dopočítáme zoom pro požadovaný průměr v pixelech.
 *
 * Na malém okně vyjde menší zoom; proto mají popisky států nízké minzoom,
 * ať jsou vidět i tam.
 */
export function globeFillZoom(fill = 1.04): number {
  if (typeof window === "undefined") return 2.6;
  const diameter = Math.min(window.innerWidth, window.innerHeight) * fill;
  const zoom = Math.log2((diameter * Math.PI) / 512);
  return Math.max(1.7, Math.min(3.4, zoom));
}

/** Hrubý střed kontinentu podle prefixu časového pásma. */
const CONTINENT_CENTER: Record<string, [number, number]> = {
  Europe: [14, 49.5],
  America: [-96, 39],
  Asia: [88, 30],
  Africa: [20, 4],
  Australia: [134, -25],
  Pacific: [174, -18],
  Atlantic: [-25, 38],
  Indian: [72, -8],
  Antarctica: [20, -75],
};

/**
 * Časové pásmo -> ISO 3166-1 alpha-2. Není to úplný seznam IANA zón, jen ty,
 * které reálně chodí z prohlížečů. Co tu chybí, spadne na prefix kontinentu.
 */
const ZONE_TO_ISO2: Record<string, string> = {
  // Evropa
  "Europe/Prague": "CZ",
  "Europe/Bratislava": "SK",
  "Europe/Vienna": "AT",
  "Europe/Berlin": "DE",
  "Europe/Busingen": "DE",
  "Europe/Zurich": "CH",
  "Europe/Warsaw": "PL",
  "Europe/Budapest": "HU",
  "Europe/Ljubljana": "SI",
  "Europe/Zagreb": "HR",
  "Europe/Belgrade": "RS",
  "Europe/Sarajevo": "BA",
  "Europe/Podgorica": "ME",
  "Europe/Skopje": "MK",
  "Europe/Tirane": "AL",
  "Europe/Bucharest": "RO",
  "Europe/Sofia": "BG",
  "Europe/Athens": "GR",
  "Europe/Istanbul": "TR",
  "Europe/Nicosia": "CY",
  "Europe/Malta": "MT",
  "Europe/Rome": "IT",
  "Europe/Vatican": "VA",
  "Europe/San_Marino": "SM",
  "Europe/Madrid": "ES",
  "Europe/Lisbon": "PT",
  "Europe/Andorra": "AD",
  "Europe/Gibraltar": "GI",
  "Europe/Paris": "FR",
  "Europe/Monaco": "MC",
  "Europe/Brussels": "BE",
  "Europe/Amsterdam": "NL",
  "Europe/Luxembourg": "LU",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Isle_of_Man": "IM",
  "Europe/Jersey": "JE",
  "Europe/Guernsey": "GG",
  "Europe/Copenhagen": "DK",
  "Europe/Oslo": "NO",
  "Europe/Stockholm": "SE",
  "Europe/Helsinki": "FI",
  "Europe/Mariehamn": "AX",
  "Europe/Tallinn": "EE",
  "Europe/Riga": "LV",
  "Europe/Vilnius": "LT",
  "Europe/Minsk": "BY",
  "Europe/Kyiv": "UA",
  "Europe/Kiev": "UA",
  "Europe/Uzhgorod": "UA",
  "Europe/Zaporozhye": "UA",
  "Europe/Chisinau": "MD",
  "Europe/Moscow": "RU",
  "Europe/Kaliningrad": "RU",
  "Europe/Samara": "RU",
  "Europe/Volgograd": "RU",
  "Europe/Saratov": "RU",
  "Europe/Astrakhan": "RU",
  "Europe/Ulyanovsk": "RU",
  "Europe/Kirov": "RU",
  "Atlantic/Reykjavik": "IS",
  "Atlantic/Faroe": "FO",
  "Atlantic/Canary": "ES",
  "Atlantic/Madeira": "PT",
  "Atlantic/Azores": "PT",

  // Asie a Blízký východ
  "Asia/Jerusalem": "IL",
  "Asia/Tel_Aviv": "IL",
  "Asia/Gaza": "PS",
  "Asia/Hebron": "PS",
  "Asia/Amman": "JO",
  "Asia/Beirut": "LB",
  "Asia/Damascus": "SY",
  "Asia/Baghdad": "IQ",
  "Asia/Tehran": "IR",
  "Asia/Riyadh": "SA",
  "Asia/Kuwait": "KW",
  "Asia/Bahrain": "BH",
  "Asia/Qatar": "QA",
  "Asia/Dubai": "AE",
  "Asia/Muscat": "OM",
  "Asia/Aden": "YE",
  "Asia/Tbilisi": "GE",
  "Asia/Yerevan": "AM",
  "Asia/Baku": "AZ",
  "Asia/Almaty": "KZ",
  "Asia/Aqtobe": "KZ",
  "Asia/Atyrau": "KZ",
  "Asia/Bishkek": "KG",
  "Asia/Dushanbe": "TJ",
  "Asia/Ashgabat": "TM",
  "Asia/Tashkent": "UZ",
  "Asia/Samarkand": "UZ",
  "Asia/Kabul": "AF",
  "Asia/Karachi": "PK",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Colombo": "LK",
  "Asia/Kathmandu": "NP",
  "Asia/Thimphu": "BT",
  "Asia/Dhaka": "BD",
  "Indian/Maldives": "MV",
  "Asia/Yangon": "MM",
  "Asia/Bangkok": "TH",
  "Asia/Vientiane": "LA",
  "Asia/Phnom_Penh": "KH",
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Saigon": "VN",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Kuching": "MY",
  "Asia/Singapore": "SG",
  "Asia/Brunei": "BN",
  "Asia/Jakarta": "ID",
  "Asia/Makassar": "ID",
  "Asia/Jayapura": "ID",
  "Asia/Manila": "PH",
  "Asia/Dili": "TL",
  "Asia/Shanghai": "CN",
  "Asia/Urumqi": "CN",
  "Asia/Chongqing": "CN",
  "Asia/Hong_Kong": "HK",
  "Asia/Macau": "MO",
  "Asia/Taipei": "TW",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Pyongyang": "KP",
  "Asia/Ulaanbaatar": "MN",
  "Asia/Yekaterinburg": "RU",
  "Asia/Novosibirsk": "RU",
  "Asia/Krasnoyarsk": "RU",
  "Asia/Irkutsk": "RU",
  "Asia/Yakutsk": "RU",
  "Asia/Vladivostok": "RU",
  "Asia/Magadan": "RU",
  "Asia/Kamchatka": "RU",
  "Asia/Omsk": "RU",
  "Asia/Barnaul": "RU",
  "Asia/Tomsk": "RU",

  // Afrika
  "Africa/Cairo": "EG",
  "Africa/Tripoli": "LY",
  "Africa/Tunis": "TN",
  "Africa/Algiers": "DZ",
  "Africa/Casablanca": "MA",
  "Africa/El_Aaiun": "EH",
  "Africa/Khartoum": "SD",
  "Africa/Juba": "SS",
  "Africa/Addis_Ababa": "ET",
  "Africa/Asmara": "ER",
  "Africa/Djibouti": "DJ",
  "Africa/Mogadishu": "SO",
  "Africa/Nairobi": "KE",
  "Africa/Kampala": "UG",
  "Africa/Kigali": "RW",
  "Africa/Bujumbura": "BI",
  "Africa/Dar_es_Salaam": "TZ",
  "Africa/Lusaka": "ZM",
  "Africa/Harare": "ZW",
  "Africa/Maputo": "MZ",
  "Africa/Lilongwe": "MW",
  "Africa/Gaborone": "BW",
  "Africa/Windhoek": "NA",
  "Africa/Johannesburg": "ZA",
  "Africa/Maseru": "LS",
  "Africa/Mbabane": "SZ",
  "Indian/Antananarivo": "MG",
  "Indian/Mauritius": "MU",
  "Africa/Luanda": "AO",
  "Africa/Kinshasa": "CD",
  "Africa/Lubumbashi": "CD",
  "Africa/Brazzaville": "CG",
  "Africa/Libreville": "GA",
  "Africa/Malabo": "GQ",
  "Africa/Douala": "CM",
  "Africa/Bangui": "CF",
  "Africa/Ndjamena": "TD",
  "Africa/Niamey": "NE",
  "Africa/Lagos": "NG",
  "Africa/Porto-Novo": "BJ",
  "Africa/Lome": "TG",
  "Africa/Accra": "GH",
  "Africa/Abidjan": "CI",
  "Africa/Ouagadougou": "BF",
  "Africa/Bamako": "ML",
  "Africa/Dakar": "SN",
  "Africa/Banjul": "GM",
  "Africa/Bissau": "GW",
  "Africa/Conakry": "GN",
  "Africa/Freetown": "SL",
  "Africa/Monrovia": "LR",
  "Africa/Nouakchott": "MR",
  "Atlantic/Cape_Verde": "CV",

  // Amerika
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "America/Detroit": "US",
  "America/Indiana/Indianapolis": "US",
  "America/Kentucky/Louisville": "US",
  "Pacific/Honolulu": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/St_Johns": "CA",
  "America/Mexico_City": "MX",
  "America/Tijuana": "MX",
  "America/Monterrey": "MX",
  "America/Cancun": "MX",
  "America/Guatemala": "GT",
  "America/Belize": "BZ",
  "America/El_Salvador": "SV",
  "America/Tegucigalpa": "HN",
  "America/Managua": "NI",
  "America/Costa_Rica": "CR",
  "America/Panama": "PA",
  "America/Havana": "CU",
  "America/Santo_Domingo": "DO",
  "America/Port-au-Prince": "HT",
  "America/Jamaica": "JM",
  "America/Puerto_Rico": "PR",
  "America/Nassau": "BS",
  "America/Barbados": "BB",
  "America/Port_of_Spain": "TT",
  "America/Curacao": "CW",
  "America/Aruba": "AW",
  "America/Bogota": "CO",
  "America/Caracas": "VE",
  "America/Guyana": "GY",
  "America/Paramaribo": "SR",
  "America/Cayenne": "GF",
  "America/Quito": "EC",
  "America/Guayaquil": "EC",
  "America/Lima": "PE",
  "America/La_Paz": "BO",
  "America/Asuncion": "PY",
  "America/Montevideo": "UY",
  "America/Argentina/Buenos_Aires": "AR",
  "America/Argentina/Cordoba": "AR",
  "America/Santiago": "CL",
  "America/Sao_Paulo": "BR",
  "America/Bahia": "BR",
  "America/Fortaleza": "BR",
  "America/Recife": "BR",
  "America/Manaus": "BR",
  "America/Belem": "BR",
  "America/Godthab": "GL",
  "America/Nuuk": "GL",

  // Oceánie
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Australia/Adelaide": "AU",
  "Australia/Darwin": "AU",
  "Australia/Hobart": "AU",
  "Pacific/Auckland": "NZ",
  "Pacific/Fiji": "FJ",
  "Pacific/Port_Moresby": "PG",
  "Pacific/Guadalcanal": "SB",
  "Pacific/Noumea": "NC",
  "Pacific/Efate": "VU",
  "Pacific/Apia": "WS",
  "Pacific/Tongatapu": "TO",
  "Pacific/Tarawa": "KI",
  "Pacific/Guam": "GU",
  "Pacific/Palau": "PW",
  "Pacific/Majuro": "MH",
  "Pacific/Tahiti": "PF",
};

export interface HomeCamera {
  center: [number, number];
  /** Co pohled určilo – hodí se pro ladění a pro popisek v UI. */
  source: "timezone" | "language" | "continent" | "fallback";
}

function timeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/** Z jazyka prohlížeče vytáhne region. `cs` se přes maximize() rozbalí na CZ. */
function localeRegions(): string[] {
  if (typeof navigator === "undefined") return [];
  const tags = navigator.languages?.length
    ? navigator.languages
    : [navigator.language].filter(Boolean);

  const out: string[] = [];
  for (const tag of tags) {
    if (!tag) continue;
    const explicit = tag.split("-")[1];
    if (explicit && /^[A-Za-z]{2}$/.test(explicit)) {
      out.push(explicit.toUpperCase());
      continue;
    }
    try {
      const region = new Intl.Locale(tag).maximize().region;
      if (region) out.push(region.toUpperCase());
    } catch {
      /* neplatný jazykový tag – přeskočíme */
    }
  }
  return out;
}

/**
 * Vybere, nad čím se globus otevře. `centers` je ISO2 -> [lon, lat]; posílá
 * ho server, aby se kvůli tomu nemusel do klienta tahat celý číselník zemí.
 */
export function detectHomeCamera(centers: Record<string, [number, number]>): HomeCamera {
  const zone = timeZone();

  const zoneIso2 = zone ? ZONE_TO_ISO2[zone] : undefined;
  if (zoneIso2 && centers[zoneIso2]) {
    return { center: centers[zoneIso2], source: "timezone" };
  }

  for (const region of localeRegions()) {
    if (centers[region]) {
      return { center: centers[region], source: "language" };
    }
  }

  const continent = zone?.split("/")[0];
  if (continent && CONTINENT_CENTER[continent]) {
    return { center: CONTINENT_CENTER[continent], source: "continent" };
  }

  return { center: EUROPE_CENTER, source: "fallback" };
}
