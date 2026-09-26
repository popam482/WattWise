import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re

# IPCC WG III AR5 (2014), Annex III: Technology-specific Cost and Performance Parameters
EMISSION_FACTORS = {
    'coal': 820.0,
    'gas': 490.0,
    'nuclear': 12.0,
    'hydro': 24.0,
    'wind': 11.0,
    'solar': 48.0,  # solar pv utility
    'biomass': 230.0
}


def _parse_number(value):
    cleaned = value.replace("\u202f", "").replace("\xa0", "").replace(" ", "")
    cleaned = re.sub(r"[^0-9,.-]", "", cleaned)
    if not cleaned:
        return 0.0
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")
    return float(cleaned)


def _find_latest_table_row(soup):
    for row in soup.select("tr"):
        cells = [cell.get_text(" ", strip=True) for cell in row.select("th, td")]
        if len(cells) < 12:
            continue

        try:
            timestamp_dt = datetime.fromisoformat(cells[0])
            timestamp_str = timestamp_dt.strftime("%Y-%m-%d %H:%M:%S")
            values = [_parse_number(value) for value in cells[1:12]]
            if values[0] > 0 or values[1] > 0:
                return timestamp_str, values
        except (ValueError, TypeError):
            continue

    raise RuntimeError("No vaid data row found in the SEN table.")


def get_current_hourly_sen_data():
    url = "https://www.sistemulenergetic.ro/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    timestamp, values = _find_latest_table_row(BeautifulSoup(response.text, "html.parser"))

    consumption = values[0]
    production = values[1]
    nuclear = values[2]
    wind = values[3]
    hydro = values[4]
    gas = values[5]
    coal = values[6]
    solar = values[7]
    biomass = values[8]
    _storage = values[9]
    balance = -values[10]

    total_green = hydro + wind + solar + biomass
    total_fossil = gas + coal
    green_share = (total_green / production * 100) if production > 0 else 0.0

    return {
        "timestamp": timestamp,
        "consumption_mw": round(consumption, 2),
        "production_mw": round(production, 2),
        "balance_mw": round(balance, 2),
        "total_green_mw": round(total_green, 2),
        "total_fossil_mw": round(total_fossil, 2),
        "nuclear_mw": round(nuclear, 2),
        "green_share_percent": round(green_share, 2),

        "coal_mw": coal,
        "gas_mw": gas,
        "hydro_mw": hydro,
        "wind_mw": wind,
        "solar_mw": solar,
        "biomass_mw": biomass
    }

def calculate_grid_carbon_intensity(sen_data):
    total_prod = sen_data['production_mw']
    if total_prod <= 0:
        return 300.0

    total_emissions = (
            (sen_data.get('coal_mw', 0) * EMISSION_FACTORS['coal']) +
            (sen_data.get('gas_mw', 0) * EMISSION_FACTORS['gas']) +
            (sen_data.get('nuclear_mw', 0) * EMISSION_FACTORS['nuclear']) +
            (sen_data.get('hydro_mw', 0) * EMISSION_FACTORS['hydro']) +
            (sen_data.get('wind_mw', 0) * EMISSION_FACTORS['wind']) +
            (sen_data.get('solar_mw', 0) * EMISSION_FACTORS['solar']) +
            (sen_data.get('biomass_mw', 0) * EMISSION_FACTORS['biomass'])
    )

    intensity_g_per_kwh = total_emissions / total_prod

    return round(intensity_g_per_kwh, 2)
