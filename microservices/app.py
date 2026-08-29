import joblib
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
from pathlib import Path

app = FastAPI(title="EcoDispatch ML API")

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "exports" / "energy_model.joblib"

model = joblib.load(MODEL_PATH)

class EnergyScenario(BaseModel):
    Total_Green: float
    Nuclear: float
    Total_Fossil: float
    Hour: int
    Day: int
    Month: int
    Consumption_Lag_1h: float
    Consumption_Lag_24h: float
    Consumption_Rolling_24h: float

class SolarRequest(BaseModel):
    lat: float
    lon: float
    system_kwp: float
    performance_factor: float

#national consumption
@app.post("/api/predict-consumption")
def predict_consumption(scenario: EnergyScenario):
    input_data = pd.DataFrame([{
        'Total Green': scenario.Total_Green,
        'Nuclear': scenario.Nuclear,
        'Total Fossil': scenario.Total_Fossil,
        'Hour': scenario.Hour,
        'Day': scenario.Day,
        'Month': scenario.Month,
        'Consumption_Lag_1h': scenario.Consumption_Lag_1h,
        'Consumption_Lag_24h': scenario.Consumption_Lag_24h,
        'Consumption_Rolling_24h': scenario.Consumption_Rolling_24h
    }])

    prediction = model.predict(input_data)[0]

    return {"prognosed_consumption_mw": float(prediction)}

@app.post("/api/solar-forecast")
def get_solar_forecast(request: SolarRequest):
    url = 'https://api.open-meteo.com/v1/forecast'
    params = {
        'lat': request.lat,
        'lon': request.lon,
        'hourly': ['shortwave_radiation', 'temperature_2m', 'cloudcover'],
        'timezone': 'auto',
        'forecast_days': 2
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        weather_data = response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=str(e))

    hourly_data = weather_data['hourly']

    df = pd.DataFrame({
        'Time': hourly_data['time'],
        'Irradiance_W_m2': hourly_data['shortwave_radiation'],
        'Temp_C': hourly_data['temperature_2m'],
        'Cloud_Cover_%': hourly_data['cloudcover']
    })

    df['Estimated_PV_Power_kW'] = (
            (df['Irradiance_W_m2'] / 1000)
            * request.system_kwp
            * request.performance_factor
    )

    return df.round(2).to_dict(orient='records')