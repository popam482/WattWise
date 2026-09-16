import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import re


def _parse_number(value):
    cleaned = value.replace("\u202f", "").replace("\xa0", "").replace(" ", "")
    cleaned = re.sub(r"[^0-9,.-]", "", cleaned)
    if not cleaned:
        raise ValueError("empty numeric value")
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")
    return float(cleaned)


def _find_latest_table_row(soup):
    measurements = []

    for row in soup.select("tr"):
        cells = [cell.get_text(" ", strip=True) for cell in row.select("th, td")]
        if len(cells) < 12:
            continue

        try:
            timestamp_dt = datetime.fromisoformat(cells[0])
            timestamp_str = timestamp_dt.strftime("%Y-%m-%d %H:%M:%S")
            values = [_parse_number(value) for value in cells[1:12]]
        except (ValueError, TypeError):
            continue

        if values[1] <= 0:
            continue

        measurements.append((timestamp_dt, timestamp_str, values))

    if not measurements:
        raise RuntimeError("No live SEN measurement row was found on sistemulenergetic.ro")

    now = datetime.now()
    target_hour = now.replace(minute=0, second=0, microsecond=0)

    hour_measurements = [
        m for m in measurements
        if m[0].date() == target_hour.date() and m[0].hour == target_hour.hour
    ]

    if hour_measurements:
        _, timestamp, values = min(hour_measurements, key=lambda m: abs(m[0].minute))
        return timestamp, values
    else:
        _, timestamp, values = max(measurements, key=lambda m: m[0])
        return timestamp, values

def get_current_hourly_sen_data():
    url = "https://www.sistemulenergetic.ro/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    timestamp, values = _find_latest_table_row(BeautifulSoup(response.text, "html.parser"))

    dt_utc = datetime.fromisoformat(timestamp)
    dt_ro = dt_utc + timedelta(hours=3)
    formatted_timestamp = dt_ro.strftime("%Y-%m-%d %H:00:00")

    consumption, production, _storage, wind, hydro, gas, coal, solar, biomass, nuclear, balance = values
    total_green = hydro + wind + solar + biomass
    total_fossil = gas + coal
    green_share = (total_green / production * 100) if production > 0 else 0.0

    return {
        "timestamp": formatted_timestamp,
        "consumption_mw": round(consumption, 2),
        "production_mw": round(production, 2),
        "balance_mw": round(balance, 2),
        "total_green_mw": round(total_green, 2),
        "total_fossil_mw": round(total_fossil, 2),
        "nuclear_mw": round(nuclear, 2),
        "green_share_percent": round(green_share, 2)
    }