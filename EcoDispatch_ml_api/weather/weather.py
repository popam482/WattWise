import requests
import pandas as pd

def fetch_solar_forecast(lat, lon):
    url = 'https://api.open-meteo.com/v1/forecast'

    params = {
        'latitude': lat,
        'longitude': lon,
        'hourly': [
            'shortwave_radiation',
            'temperature_2m',
            'cloudcover'
        ],
        'timezone': 'auto',
        'forecast_days': 2
    }

    response = requests.get(
        url,
        params=params,
        timeout=10
    )
    response.raise_for_status()

    return response.json()


def calculate_pv_production(
        weather_data,
        system_kwp,
        performance_factor
):
    hourly_data = weather_data['hourly']

    df = pd.DataFrame({
        'Time': pd.to_datetime(hourly_data['time']),
        'Irradiance_W_m2': hourly_data['shortwave_radiation'],
        'Temp_C': hourly_data['temperature_2m'],
        'Cloud_Cover': hourly_data['cloudcover']
    })

    # Estimated PV power:
    # kW = kWp × irradiance / 1000 × performance factor
    df['Estimated_PV_Power_kW'] = (
            (df['Irradiance_W_m2'] / 1000)
            * system_kwp
            * performance_factor
    )

    return df.round(2)

def get_forecast_for_location(lat: float = None, lon: float = None, system_kwp: float = 5.0):
    #Fallback (lat/lon no provided)
    target_lat = lat if lat is not None else 44.43
    target_lon = lon if lon is not None else 26.10

    weather_json = fetch_solar_forecast(target_lat, target_lon)
    return calculate_pv_production(weather_json, system_kwp)

