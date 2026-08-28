import joblib
from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd

app = FastAPI(title="EcoDispatch ML API")

model = joblib.load('../exports/energy_model.joblib')

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