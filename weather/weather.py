import requests
import pandas as pd
from datetime import datetime

def get_location():
    #automatic location based on IP
    response = requests.get('http://ip-api.com/json/')
    data = response.json()

    if data['status'] == 'success':
        return data['lat'], data['lon'], data['city']
    else:
        return 44.43, 26.10, 'Bucuresti(Fallback)'

def fetch_solar_forecast(lat, lon):
    url = 'https://api.open-meteo.com/v1/forecast'
    params = {
        'latitude': lat,
        'longitude': lon,
        'hourly': ['shortwave_radiation', 'temperature_2m', 'cloudcover'],
        'timezone': 'auto',
        'forecast_days': 2
    }

    response = requests.get(url, params=params)
    return response.json()

def calculate_pv_production(weather_data, system_kwp, efficiency_factor):
    # hourly data
    hourly_data = weather_data['hourly']

    df = pd.DataFrame({
        'Time': pd.to_datetime(hourly_data['time']),
        'Irradiance_W_m2': hourly_data['shortwave_radiation'],
        'Temp_C': hourly_data['temperature_2m'],
        'Cloud_Cover_%': hourly_data['cloudcover']
    })

    # Produced Power (kW) = Sistem_kWp * (Irradiation / 1000) * Efficiency_factor
    df['Estimated_PV_Yield_kW'] = (df['Irradiance_W_m2'] / 1000) * system_kwp * efficiency_factor

    df_daylight = df['Estimated_PV_Yield_kW'].copy()

    return df_daylight.round(2)

def main():
    print("Determining location...")
    lat, lon, city = get_location()
    print(f"Detected location: {city} (Lat: {lat}, Lon: {lon})\n")

    print("Gathering weather data...")
    weather_json = fetch_solar_forecast(lat, lon)

    print("Calculation of estimated photovoltaic production (System: 5 kWp, Efficiency: 80%)...\n")
    df_production = calculate_pv_production(weather_json, system_kwp=5.0, efficiency_factor=0.8)

    # first 15 hours of production
    print(df_production.head(24).to_string(index=False))

if __name__ == "__main__":
    main()