import requests
import pandas as pd


def get_location():
    # Automatic location based on IP
    response = requests.get(
        'http://ip-api.com/json/',
        timeout=10
    )
    response.raise_for_status()

    data = response.json()

    if data['status'] == 'success':
        return data['lat'], data['lon'], data['city']

    return 44.43, 26.10, 'Bucuresti(Fallback)'


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
        'Cloud_Cover_%': hourly_data['cloudcover']
    })

    # Estimated PV power:
    # kW = kWp × irradiance / 1000 × performance factor
    df['Estimated_PV_Power_kW'] = (
            (df['Irradiance_W_m2'] / 1000)
            * system_kwp
            * performance_factor
    )

    return df.round(2)


def main():

    print("Determining location...")

    lat, lon, city = get_location()

    print(
        f"Detected location: {city} "
        f"(Lat: {lat}, Lon: {lon})\n"
    )

    print("Gathering weather data...")

    weather_json = fetch_solar_forecast(lat, lon)

    print(
        "Calculating estimated photovoltaic production "
        "(System: 5 kWp, Performance factor: 80%)...\n"
    )

    df_production = calculate_pv_production(
        weather_json,
        system_kwp=5.0,
        performance_factor=0.8
    )

    print(
        df_production.head(24).to_string(index=False)
    )


if __name__ == "__main__":
    main()