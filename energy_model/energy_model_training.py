import os

import numpy as np
import pandas as pd

from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
import joblib

def read_dataframe():
    df = pd.read_csv('../datasets/electricityConsumptionAndProduction.csv')
    df['DateTime'] = pd.to_datetime(df['DateTime'])
    # df.set_index('DateTime', inplace=True)
    return df


def clear_data(df):
    df_to_clean = df.copy()
    df_to_clean['Nuclear'] = df_to_clean['Nuclear'].fillna(df_to_clean['Nuclear'].median())
    df_to_clean['Wind'] = df_to_clean['Wind'].fillna(df_to_clean['Wind'].median())
    df_to_clean['Hydroelectric'] = df_to_clean['Hydroelectric'].fillna(df_to_clean['Hydroelectric'].median())
    df_to_clean['Oil and Gas'] = df_to_clean['Oil and Gas'].fillna(df_to_clean['Oil and Gas'].median())
    df_to_clean['Coal'] = df_to_clean['Coal'].fillna(df_to_clean['Coal'].median())
    df_to_clean['Solar'] = df_to_clean['Solar'].fillna(df_to_clean['Solar'].median())
    df_to_clean['Biomass'] = df_to_clean['Biomass'].fillna(df_to_clean['Biomass'].median())
    return df_to_clean

def fossil_foot(clean_df):
    clean_df['Total Fossil'] = clean_df['Coal'] + clean_df['Oil and Gas']
    return clean_df

def green_foot(clean_df):
    clean_df['Total Green'] = clean_df['Wind'] + clean_df['Hydroelectric'] + clean_df['Solar'] + clean_df['Biomass']
    return clean_df

def add_time_series_features(clean_df):
    df_feat = clean_df.copy()

    df_feat['Hour'] = df_feat['DateTime'].dt.hour
    df_feat['Day'] = df_feat['DateTime'].dt.dayofweek
    df_feat['Month'] = df_feat['DateTime'].dt.month

    df_feat['Consumption_Lag_1h'] = df_feat['Consumption'].shift(1)
    df_feat['Consumption_Lag_24h'] = df_feat['Consumption'].shift(24)

    df_feat['Consumption_Rolling_24h'] = (
        df_feat['Consumption'].rolling(window=24).mean()
    )

    df_feat = df_feat.dropna().reset_index(drop=True)

    return df_feat

def train_energy_pipeline(clean_df):
    df_ml = clean_df.copy()

    df_ml['Hour'] = df_ml['DateTime'].dt.hour
    df_ml['Day'] = df_ml['DateTime'].dt.dayofweek
    df_ml['Month'] = df_ml['DateTime'].dt.month

    #define features and target
    feature_cols = [
        'Total Green',
        'Nuclear',
        'Total Fossil',
        'Hour',
        'Day',
        'Month',
        'Consumption_Lag_1h',
        'Consumption_Lag_24h',
        'Consumption_Rolling_24h'
    ]
    X = df_ml[feature_cols]
    y = df_ml['Consumption']

    #split the data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, shuffle=False)

    #create the pipeline
    energy_pipeline = Pipeline([
        ('scaler', StandardScaler()), #scale
        ('regressor', RandomForestRegressor(n_estimators=100, n_jobs=-1, random_state=42)) #model
    ])

    #traning using the pipeline
    energy_pipeline.fit(X_train, y_train)

    #prediction
    y_pred = energy_pipeline.predict(X_test)

    #evaluation
    mae = mean_absolute_error(y_test, y_pred)
    print(f"\n--- PIPELINE MODEL RESULTS ---")
    print(f"Pipeline MAE: {mae:.2f} MW")

    return energy_pipeline

def save_energy_model(model, filepath='../exports/energy_model.joblib'):
    if not os.path.exists("../exports"):
        os.makedirs("../exports")

    joblib.dump(model, filepath)
    print(f"\n Model successfully saved to {filepath}")

def main():
    df = read_dataframe()
    clean_df = clear_data(df)

    clean_df = fossil_foot(clean_df)
    clean_df = green_foot(clean_df)

    df_feat = add_time_series_features(clean_df)

    pipeline = train_energy_pipeline(df_feat)
    save_energy_model(pipeline)
    scenario = pd.DataFrame([{
        'Total Green': 100,
        'Nuclear': 700,
        'Total Fossil': 1500,
        'Hour': 21,
        'Day': 2,
        'Month': 8,
        'Consumption_Lag_1h': 6200,
        'Consumption_Lag_24h': 6000,
        'Consumption_Rolling_24h': 6100
    }])

if __name__ == '__main__':
    main()
