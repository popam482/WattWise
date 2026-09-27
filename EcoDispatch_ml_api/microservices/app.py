import datetime
from typing import Optional
from zoneinfo import ZoneInfo

import joblib
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
from pathlib import Path

import shap

from energy_model.sen_realtime import get_current_hourly_sen_data, calculate_grid_carbon_intensity

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
    tilt: Optional[float] = 35.0
    azimuth: Optional[float] = 180.0
    performance_factor: float


class ApplianceScheduleRequest(BaseModel):
    user_type: str  # 'PROSUMER' or 'CONSUMER'
    duration_hours: int
    power_kw: float
    lat: Optional[float] = None
    lon: Optional[float] = None
    system_kwp: Optional[float] = 0.0
    tilt: Optional[float] = 35.0
    azimuth: Optional[float] = 180.0


class ScheduleRecommendation(BaseModel):
    best_start_time: str
    best_end_time: str
    total_green_energy_score: float
    recommended_carbon_intensity: float
    baseline_carbon_intensity: float
    reason: str
    decision_factors: dict[str, float]


class PredictionExplanationResponse(BaseModel):
    prognosed_consumption_mw: float
    feature_importance: dict[str, float]
    shap_contributions: dict[str, float]


@app.get("/")
def home():
    return {"status": "EcoDispatch ML API is running. Go to /docs to test endpoints."}


# national consumption
@app.post("/api/predict-consumption", response_model=PredictionExplanationResponse)
def predict_consumption(scenario: EnergyScenario):
    feature_cols = [
        'Total Green', 'Nuclear', 'Total Fossil',
        'Hour', 'Day', 'Month',
        'Consumption_Lag_1h', 'Consumption_Lag_24h', 'Consumption_Rolling_24h'
    ]

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
    }])[feature_cols]

    scaler = model.named_steps['scaler']
    regressor = model.named_steps['regressor']

    input_scaled = scaler.transform(input_data)
    prediction = regressor.predict(input_scaled)[0]

    importances = regressor.feature_importances_
    feature_importance_dict = {
        col: round(float(imp) * 100, 2)
        for col, imp in zip(feature_cols, importances)
    }

    explainer = shap.TreeExplainer(regressor)
    shap_values = explainer.shap_values(input_scaled)[0]

    shap_dict = {
        col: round(float(val), 2)
        for col, val in zip(feature_cols, shap_values)
    }

    return PredictionExplanationResponse(
        prognosed_consumption_mw=float(round(prediction, 2)),
        feature_importance=feature_importance_dict,
        shap_contributions=shap_dict
    )


# solar forecast
@app.post("/api/solar-forecast")
def get_solar_forecast(request: SolarRequest):
    url = 'https://api.open-meteo.com/v1/forecast'
    params = {
        'latitude': request.lat,
        'longitude': request.lon,
        'hourly': ['shortwave_radiation', 'temperature_2m', 'cloud_cover'],
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
        'Cloud_Cover': hourly_data['cloud_cover']
    })

    df['Estimated_PV_Power_kW'] = (
            (df['Irradiance_W_m2'] / 1000)
            * request.system_kwp
            * request.performance_factor
    )

    return df.round(2).to_dict(orient='records')


@app.post("/api/recommendations/best-time", response_model=ScheduleRecommendation)
def get_best_time_for_appliance(req: ApplianceScheduleRequest):
    current_time = datetime.datetime.now(ZoneInfo("Europe/Bucharest"))
    current_hour = current_time.hour
    forecast_hours = 24
    hourly_energy_scores = []

    for i in range(forecast_hours):
        hour_of_day = (current_hour + i) % 24
        score = 0.0

        if req.user_type == "PROSUMER":
            peak_hour = 13.0 + ((req.azimuth or 180.0) - 180.0) / 30.0

            if 6 <= hour_of_day <= 20:
                distance_from_peak = abs(peak_hour - hour_of_day)
                tilt_penalty = abs((req.tilt or 35.0) - 35.0) * 0.005

                estimated_pv_power = (req.system_kwp or 0.0) * max(0, (1.0 - (distance_from_peak * 0.15) - tilt_penalty))
                score = min(estimated_pv_power / req.power_kw, 1.0) if req.power_kw > 0 else 1.0
            else:
                score = 0.0
        else:
            try:
                realtime_grid = get_current_hourly_sen_data()
                green_share = realtime_grid["green_share_percent"] / 100.0
                if 10 <= hour_of_day <= 16:
                    score = green_share * 1.2
                else:
                    score = green_share * 0.8
                score = min(max(score, 0.0), 1.0)
            except Exception:
                score = 0.5

        hourly_energy_scores.append({
            "hour_offset": i,
            "actual_hour": hour_of_day,
            "score": score
        })

    best_window_start = 0
    max_window_score = -1.0

    for i in range(forecast_hours - req.duration_hours + 1):
        window_score = sum(item["score"] for item in hourly_energy_scores[i : i + req.duration_hours])
        if window_score > max_window_score:
            max_window_score = window_score
            best_window_start = i

    start_time = current_time.replace(minute=0, second=0, microsecond=0) + datetime.timedelta(hours=best_window_start)
    end_time = start_time + datetime.timedelta(hours=req.duration_hours)

    avg_coverage = round((max_window_score / req.duration_hours) * 100, 1)

    try:
        realtime_sen = get_current_hourly_sen_data()
        current_grid_intensity = calculate_grid_carbon_intensity(realtime_sen)
    except Exception:
        current_grid_intensity = 300.0

    if req.user_type == "PROSUMER":
        reason = f"During this period, the panels cover {avg_coverage}% of the consumption of the {req.power_kw} kW appliance."
        decision_factors = {
            "Direct Solar Coverage": avg_coverage,
            "Azimuth/Tilt Efficiency": round(max(0, 100 - abs((req.tilt or 35.0) - 35.0) * 2), 1),
            "External Grid Impact": round(100 - avg_coverage, 1)
        }
        # produmer ~48 gCO2/kWh (IPCC)
        rec_carbon_intensity = round(48.0 * (avg_coverage / 100.0) + current_grid_intensity * ((100.0 - avg_coverage) / 100.0), 2)
    else:
        reason = f"Optimal time slot! The national grid has a high share of green energy."
        decision_factors = {
            "National Grid Green Energy Share": avg_coverage,
            "Avoidance of Fossil-Fuel Peak Hours": round(min(avg_coverage * 0.8, 100.0), 1)
        }
        rec_carbon_intensity = round(current_grid_intensity * (1.0 - (avg_coverage / 100.0) * 0.4), 2)
    # fossil
    fossil_ratio = (realtime_sen.get("total_fossil_mw", 0) / max(realtime_sen.get("production_mw", 1), 1)) if 'realtime_sen' in locals() else 0.4
    baseline_carbon_intensity = round(current_grid_intensity + (fossil_ratio * 180.0) + 100.0, 2)

    return ScheduleRecommendation(
        best_start_time=start_time.strftime("%Y-%m-%d %H:00:00"),
        best_end_time=end_time.strftime("%Y-%m-%d %H:00:00"),
        total_green_energy_score=round(max_window_score, 2),
        recommended_carbon_intensity=rec_carbon_intensity,
        baseline_carbon_intensity=baseline_carbon_intensity,
        reason=reason,
        decision_factors=decision_factors
    )

@app.get("/api/grid/status")
def get_grid_status():
    try:
        realtime_data = get_current_hourly_sen_data()
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"SEN data is temporarily unavailable: {error}"
        ) from error

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