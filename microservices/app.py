import joblib
from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd

app = FastAPI(title="EcoDispatch ML API")

model = joblib.load('../exports/models/model.joblib')

class EnergyScenario(BaseModel):
    Nuclear: float
    Hour: