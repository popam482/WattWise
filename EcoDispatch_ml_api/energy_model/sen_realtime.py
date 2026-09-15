import pandas as pd
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

def get_current_hourly_sen_data():
    csv_path = BASE_DIR / "datasets" / "electricityConsumptionAndProduction.csv"

    if not csv_path.exists():
        csv_path = BASE_DIR / "electricityConsumptionAndProduction.csv"

    df = pd.read_csv(csv_path)
    df['DateTime'] = pd.to_datetime(df['DateTime'])

    now = datetime.now()
    rounded_hour = now.replace(minute=0, second=0, microsecond=0)

    matching_rows = df[df['DateTime'].dt.hour == rounded_hour.hour]

    if not matching_rows.empty:
        latest = matching_rows.iloc[-1]
    else:
        latest = df.iloc[-1]

    hydro = float(latest.get("Hydroelectric", 0))
    wind = float(latest.get("Wind", 0))
    solar = float(latest.get("Solar", 0))
    biomass = float(latest.get("Biomass", 0))

    total_green = hydro + wind + solar + biomass
    coal = float(latest.get("Coal", 0))
    oil_gas = float(latest.get("Oil and Gas", 0))
    total_fossil = coal + oil_gas
    nuclear = float(latest.get("Nuclear", 0))

    total_production = total_green + total_fossil + nuclear
    consumption = float(latest.get("Consumption", 0))

    green_share = (total_green / total_production * 100) if total_production > 0 else 0.0

    return {
        "timestamp": rounded_hour.strftime("%Y-%m-%d %H:00:00"),
        "consumption_mw": round(consumption, 2),
        "production_mw": round(total_production, 2),
        "balance_mw": round(total_production - consumption, 2), # > 0 Export, < 0 Import
        "total_green_mw": round(total_green, 2),
        "total_fossil_mw": round(total_fossil, 2),
        "nuclear_mw": round(nuclear, 2),
        "green_share_percent": round(green_share, 2)
    }