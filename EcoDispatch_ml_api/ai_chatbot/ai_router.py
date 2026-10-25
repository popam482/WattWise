import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from groq import Groq

app = FastAPI()
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

class ChatRequest(BaseModel):
    user_id: int
    message: str
    context: Dict[str, Any] # (prosumer, solar_kw, saved_co2, etc.)

class BriefingRequest(BaseModel):
    user_name: str
    user_type: str
    saved_co2_kg: float
    saved_money_ron: float
    active_schedules_count: int
    top_solar_hour: Optional[str] = "13:00"

@app.post("/api/ai/briefing")
def generate_executive_briefing(req: BriefingRequest):
    prompt = f"""
   You are EcoAssistant, the intelligent copilot for the EcoDispatch application.
       Generate a short (maximum 2–3 sentences), sustainable, and professional executive summary in Romanian/English(based on the input) for the user.

       USER DATA:
       - Name: {req.user_name}
       - Type: {req.user_type}
       - Total CO2 avoided: {req.saved_co2_kg} kg
       - Total money saved: {req.saved_money_ron} RON
       - Active schedules today: {req.active_schedules_count}
       - Peak solar hour today: {req.top_solar_hour}

       Include a brief congratulatory note regarding the savings and provide one actionable recommendation for today. Do not use Markdown formatting or generic, sterile introductions.
    """

    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.6,
            max_tokens=150
        )
        return {"briefing": response.choices[0].message.content.strip()}
    except Exception as e:
        return {"briefing": f"Welcome back, {req.user_name}! Today is a great day to follow green energy windows and maximize your solar efficiency."}

@app.post("/api/ai/chat")
def chat_with_assistant(req: ChatRequest):
    appliances_list = req.context.get('appliances_raw', [])

    system_context = f"""
 You are EcoAssistant, the autonomous assistant for EcoDispatch.
     Provide brief, clear, and friendly responses in Romanian.

     USER'S AVAILABLE APPLIANCES:
     {req.context.get('appliances')}

     ACTIVE SCHEDULED TASKS:
     {req.context.get('scheduled_tasks')}

     SOLAR & GRID FORECAST:
     - Forecasted solar peak: 13:00 - 15:00 (maximum production)
     - Minimum carbon intensity: 13:00 (90 gCO2/kWh)

     ACTION RULE:
     If a time slot is recommended for a specific appliance from the list above, mention the recommended time (e.g., 13:00).
     """
    messages = [
        {"role": "system", "content": system_context},
        {"role": "user", "content": req.message}
    ]

    try:
        response = client.chat.completions.create(
            messages=messages,
            model="llama-3.1-8b-instant",
            temperature=0.4,
            max_tokens=250
        )
        reply = response.choices[0].message.content.strip()

        suggested_action = None

        for app in appliances_list:
            app_name = app.get('name', '')
            if app_name.lower() in req.message.lower() or app_name.lower() in reply.lower():
                import re
                time_match = re.search(r'\b([0-1]?[0-9]|2[0-3]):00\b', reply)
                target_time = time_match.group(0) if time_match else "13:00"

                suggested_action = {
                    "type": "SCHEDULE_APPLIANCE",
                    "applianceId": app.get('id'),
                    "applianceName": app_name,
                    "time": target_time,
                    "durationHours": app.get('preferredDuration') or 2,
                    "label": f"Schedule {app_name} at {target_time}"
                }
                break

        return {
            "reply": reply,
            "action": suggested_action
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))