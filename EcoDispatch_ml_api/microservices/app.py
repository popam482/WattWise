import datetime
from typing import Optional

import joblib
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
from pathlib import Path

from EcoDispatch_ml_api.energy_model.sen_realtime import get_current_hourly_sen_data

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


class ApplianceScheduleRequest(BaseModel):
    user_type: str  # 'PROSUMER' or 'CONSUMER'
    duration_hours: int
    power_kw: float
    lat: Optional[float] = None
    lon: Optional[float] = None
    system_kwp: Optional[float] = 0.0


class ScheduleRecommendation(BaseModel):
    best_start_time: str
    best_end_time: str
    total_green_energy_score: float
    reason: str


@app.get("/")
def home():
    return {"status": "EcoDispatch ML API is running. Go to /docs to test endpoints."}


# current national grid status
@app.get("/api/grid/status")
def get_grid_status():
    grid_data = pd.read_csv(BASE_DIR / "datasets" / "electricityConsumptionAndProduction.csv")
    latest = grid_data.iloc[-1]

    return {
        "Total_Green_MW": float(latest["Total Green"]),
        "Total_Fossil": float(latest["Total Fossil"]),
        "Nuclear_MW": float(latest["Nuclear"]),
        "Green_Share_Percent": float(latest["Green Percentage"]),
        "Predicted_Consumption_MW": float(latest["Consumption"])
    }


# national consumption
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


# solar forecast
@app.post("/api/solar-forecast")
def get_solar_forecast(request: SolarRequest):
    url = 'https://api.open-meteo.com/v1/forecast'
    params = {
        'latitude': request.lat,
        'longitude': request.lon,
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
        'Cloud_Cover': hourly_data['cloudcover']
    })

    df['Estimated_PV_Power_kW'] = (
            (df['Irradiance_W_m2'] / 1000)
            * request.system_kwp
            * request.performance_factor
    )

    return df.round(2).to_dict(orient='records')


@app.post("/api/recommendations/best-time", response_model=ScheduleRecommendation)
def get_best_time_for_appliance(req: ApplianceScheduleRequest):
    current_hour = datetime.datetime.now().hour
    forecast_hours = 24
    hourly_energy_scores = []

    for i in range(forecast_hours):
        hour_of_day = (current_hour + i) % 24
        score = 0.0

        if req.user_type == "PROSUMER":
            estimated_pv_power = 0.0
            # solar production based on the hour of the day
            if 7 <= hour_of_day <= 19:
                distance_from_noon = abs(13 - hour_of_day)
                estimated_pv_power = (req.system_kwp or 0.0) * (1.0 - (distance_from_noon * 0.15))
                estimated_pv_power = max(0.0, estimated_pv_power)
            # score
            if req.power_kw > 0.0:
                coverage_ratio = estimated_pv_power / req.power_kw
                score = min(coverage_ratio, 1.0)
            else:
                score = 1.0
        else:
            # CONSUMER - based on green energy
            if 11 <= hour_of_day <= 15:
                score = 0.9
            elif hour_of_day < 6 or hour_of_day > 22:
                score = 0.7
            else:
                score = 0.3

        hourly_energy_scores.append({
            "hour_offset": i,
            "actual_hour": hour_of_day,
            "score": score
        })

        #sliding window
    best_window_start = 0
    max_window_score = -1.0

    for i in range(forecast_hours - req.duration_hours + 1):
        window_score = sum(item["score"] for item in hourly_energy_scores[i : i + req.duration_hours])
        if window_score > max_window_score:
            max_window_score = window_score
            best_window_start = i

    start_time = datetime.datetime.now() + datetime.timedelta(hours=best_window_start)
    end_time = start_time + datetime.timedelta(hours=req.duration_hours)

    avg_coverage = round((max_window_score / req.duration_hours) * 100, 1)

    if req.user_type == "PROSUMER":
        reason = f"During this interval, the photovoltaics cover {avg_coverage}% of the appliance's {req.power_kw} kW consumption."
    else:
        reason = f"Optimal interval! The national grid is using a high percentage of green energy."

    return ScheduleRecommendation(
        best_start_time=start_time.strftime("%Y-%m-%d %H:00:00"),
        best_end_time=end_time.strftime("%Y-%m-%d %H:00:00"),
        total_green_energy_score=round(max_window_score, 2),
        reason=reason
    )

@app.get("/api/grid/status")
def get_grid_status():
    realtime_data = get_current_hourly_sen_data()

    return {
        "Total_Green_MW": realtime_data["total_green_mw"],
        "Total_Fossil": realtime_data["total_fossil_mw"],
        "Nuclear_MW": realtime_data["nuclear_mw"],
        "Green_Share_Percent": realtime_data["green_share_percent"],
        "Predicted_Consumption_MW": realtime_data["consumption_mw"],
        "Production_MW": realtime_data["production_mw"],
        "Balance_MW": realtime_data["balance_mw"],
        "Timestamp": realtime_data["timestamp"]
    }
