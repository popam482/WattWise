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
from energy_model.opcom_realtime import get_day_ahead_prices
from ai_chatbot.ai_router import router as ai_router

app = FastAPI(title="EcoDispatch ML API")
app.include_router(ai_router)

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
    committed_power_per_hour: dict[int, float] = {}
    earliest_start: Optional[str] = None
    latest_end: Optional[str] = None

class ScheduleRecommendation(BaseModel):
    best_start_time: str
    best_end_time: str
    total_green_energy_score: float
    recommended_carbon_intensity: float
    baseline_carbon_intensity: float
    recommended_energy_price: float
    baseline_energy_price: float
    reason: str
    decision_factors: dict[str, float]


class PredictionExplanationResponse(BaseModel):
    prognosed_consumption_mw: float
    feature_importance: dict[str, float]
    shap_contributions: dict[str, float]


def _parse_schedule_time(value: Optional[str], fallback: datetime.datetime) -> datetime.datetime:
    if not value:
        return fallback

    try:
        parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=ZoneInfo("Europe/Bucharest"))
        return parsed.astimezone(ZoneInfo("Europe/Bucharest")).replace(
            minute=0, second=0, microsecond=0
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid schedule time: {value}"
        ) from error


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

    if not (-90 <= request.lat <= 90 and -180 <= request.lon <= 180):
        raise HTTPException(status_code=400, detail="Invalid latitude or longitude")
    if request.system_kwp < 0 or request.performance_factor < 0:
        raise HTTPException(status_code=400, detail="PV capacity and performance factor must be non-negative")

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        weather_data = response.json()
    except (requests.exceptions.RequestException, ValueError) as e:
        raise HTTPException(status_code=502, detail=f"Weather provider unavailable: {e}") from e

    hourly_data = weather_data.get("hourly")
    if not hourly_data or not all(
        key in hourly_data
        for key in ("time", "shortwave_radiation", "temperature_2m", "cloud_cover")
    ):
        raise HTTPException(status_code=502, detail="Weather provider returned an incomplete forecast")

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
    current_time = current_time.replace(minute=0, second=0, microsecond=0)
    earliest = _parse_schedule_time(req.earliest_start, current_time)
    latest_end = _parse_schedule_time(
        req.latest_end, current_time + datetime.timedelta(hours=24)
    )
    if earliest < current_time:
        earliest = current_time
    if latest_end <= earliest:
        raise HTTPException(status_code=400, detail="latest_end must be after earliest_start")

    forecast_hours = int((latest_end - earliest).total_seconds() // 3600)
    if forecast_hours < req.duration_hours:
        raise HTTPException(
            status_code=400,
            detail="The selected time window is shorter than the appliance duration"
        )

    hourly_energy_scores = []

    opcom_prices = get_day_ahead_prices()
    try:
        realtime_sen = get_current_hourly_sen_data()
        current_grid_intensity = calculate_grid_carbon_intensity(realtime_sen)
        green_share = realtime_sen["green_share_percent"] / 100.0
    except Exception:
        realtime_sen = {}
        current_grid_intensity = 300.0
        green_share = 0.5

    for i in range(forecast_hours):
        hour_of_day = (earliest.hour + i) % 24

        price_at_hour = opcom_prices.get(hour_of_day, 0.5)
        price_score = max(0.0, 1.0 - (price_at_hour / 1.5))
        solar_score = 0.0

        if req.user_type == "PROSUMER":
            peak_hour = 13.0 + ((req.azimuth or 180.0) - 180.0) / 30.0

            if 6 <= hour_of_day <= 20:
                distance_from_peak = abs(peak_hour - hour_of_day)
                tilt_penalty = abs((req.tilt or 35.0) - 35.0) * 0.005

                estimated_pv_power = (req.system_kwp or 0.0) * max(0, (1.0 - (distance_from_peak * 0.15) - tilt_penalty))
                already_committed = req.committed_power_per_hour.get(hour_of_day, 0.0)
                net_available_pv = max(0.0, estimated_pv_power - already_committed)

                solar_score = min(net_available_pv / req.power_kw, 1.0) if req.power_kw > 0 else 1.0
        elif 10 <= hour_of_day <= 16:
            solar_score = min(green_share * 1.2, 1.0)

        daylight_bonus = 0.15 if 10 <= hour_of_day <= 16 else 0.0
        estimated_carbon = current_grid_intensity * (1.0 - 0.35 * solar_score - daylight_bonus)
        carbon_score = max(0.0, 1.0 - estimated_carbon / 600.0)
        final_score = (carbon_score * 0.55) + (solar_score * 0.25) + (price_score * 0.20)

        hourly_energy_scores.append({
            "hour_offset": i,
            "actual_hour": hour_of_day,
            "score": final_score,
            "price": price_at_hour,
            "carbon_intensity": estimated_carbon,
            "solar_score": solar_score
        })

    best_window_start = 0
    max_window_score = -1.0

    for i in range(forecast_hours - req.duration_hours + 1):
        window_score = sum(item["score"] for item in hourly_energy_scores[i : i + req.duration_hours])
        if window_score > max_window_score:
            max_window_score = window_score
            best_window_start = i

    start_time = earliest + datetime.timedelta(hours=best_window_start)
    end_time = start_time + datetime.timedelta(hours=req.duration_hours)

    avg_coverage = round((max_window_score / req.duration_hours) * 100, 1)
    selected_hours = hourly_energy_scores[
        best_window_start:best_window_start + req.duration_hours
    ]
    rec_carbon_intensity = sum(
        item["carbon_intensity"] for item in selected_hours
    ) / req.duration_hours

    if req.user_type == "PROSUMER":
        reason = f"During this period, the panels cover {avg_coverage}% of the consumption of the {req.power_kw} kW appliance."
        decision_factors = {
            "Direct Solar Coverage": avg_coverage,
            "Azimuth/Tilt Efficiency": round(max(0, 100 - abs((req.tilt or 35.0) - 35.0) * 2), 1),
            "External Grid Impact": round(100 - avg_coverage, 1)
        }
        # prosumer ~48 gCO2/kWh (IPCC)
    else:
        reason = f"Selected the lowest-carbon {req.duration_hours}-hour window in the allowed interval."
        decision_factors = {
            "National Grid Green Energy Share": avg_coverage,
            "Avoidance of Fossil-Fuel Peak Hours": round(min(avg_coverage * 0.8, 100.0), 1)
        }
    # fossil
    fossil_ratio = (realtime_sen.get("total_fossil_mw", 0) / max(realtime_sen.get("production_mw", 1), 1)) if 'realtime_sen' in locals() else 0.4
    baseline_carbon_intensity = round(current_grid_intensity + (fossil_ratio * 180.0) + 100.0, 2)

    recommended_price = sum(item["price"] for item in hourly_energy_scores[best_window_start : best_window_start + req.duration_hours]) / req.duration_hours

    baseline_price = (opcom_prices.get(18, 1.3) + opcom_prices.get(19, 1.5) + opcom_prices.get(20, 1.4) + opcom_prices.get(21, 1.1)) / 4.0

    return ScheduleRecommendation(
        best_start_time=start_time.strftime("%Y-%m-%d %H:00:00"),
        best_end_time=end_time.strftime("%Y-%m-%d %H:00:00"),
        total_green_energy_score=round(max_window_score, 2),
        recommended_carbon_intensity=round(rec_carbon_intensity, 2),
        baseline_carbon_intensity=baseline_carbon_intensity,
        recommended_energy_price=round(recommended_price, 3),
        baseline_energy_price=round(baseline_price, 3),
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