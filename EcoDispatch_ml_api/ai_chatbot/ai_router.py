import os
import re
from fastapi import HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
try:
    from groq import Groq
except ImportError:
    Groq = None

from fastapi import APIRouter

router = APIRouter(prefix="/api/ai")
client = Groq(api_key=os.environ["GROQ_API_KEY"]) if Groq and os.environ.get("GROQ_API_KEY") else None
groq_model = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")


def get_response_text(response):
    text = (response.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError("Groq returned an empty response")
    return text


def keyword_fallback(message: str, context: Dict[str, Any]) -> str:
    lowered = (message or "").lower()
    if "co2" in lowered or "econom" in lowered or "save" in lowered:
        return (
            f"You have saved approximately {context.get('saved_co2_kg', 0)} kg of CO2 "
            f"and {context.get('saved_money_ron', 0)} RON."
        )
    if "washing" in lowered or "washer" in lowered or "spalat" in lowered:
        return "The best time to run the washing machine is 13:00-15:00, when more renewable energy is available."
    if "hello" in lowered or "buna" in lowered or "salut" in lowered or "hi" in lowered:
        return "Hello! I can help you with savings, solar energy, and scheduling appliances during green energy windows."
    return "For lower consumption and emissions, schedule appliances between 13:00 and 15:00."


class ChatRequest(BaseModel):
    user_id: int
    message: str
    context: Dict[str, Any]  # (prosumer, solar_kw, saved_co2, etc.)


class BriefingRequest(BaseModel):
    user_name: str
    user_type: str
    saved_co2_kg: float
    saved_money_ron: float
    active_schedules_count: int = 0
    optimized_runs_count: int = 0
    top_solar_hour: Optional[str] = "13:00"


def _normalize_greenest_window(top_solar_hour: Optional[str]) -> str:
    raw = (top_solar_hour or "13:00").strip()
    # Accept "13:00", "around 13:00", or "13"
    if raw.lower().startswith("around "):
        return raw
    if ":" not in raw and raw.isdigit():
        raw = f"{int(raw):02d}:00"
    return f"around {raw}"


def _is_onboarding_user(req: BriefingRequest) -> bool:
    co2 = float(req.saved_co2_kg or 0)
    money = float(req.saved_money_ron or 0)
    runs = int(req.optimized_runs_count or 0)
    return runs == 0 or (co2 <= 0 and money <= 0)


def briefing_fallback(req: BriefingRequest) -> str:
    greenest_window = _normalize_greenest_window(req.top_solar_hour)
    if _is_onboarding_user(req):
        return (
            f"Welcome to WattWise! Schedule your first appliance {greenest_window} today "
            f"to start cutting CO2 emissions and saving on energy bills."
        )
    return (
        f"Great progress! You've avoided {float(req.saved_co2_kg):.1f} kg of CO2 so far. "
        f"Plan your next appliance run {greenest_window} for optimal savings."
    )


def build_briefing_system_prompt(req: BriefingRequest) -> str:
    co2_avoided = float(req.saved_co2_kg or 0)
    money_saved = float(req.saved_money_ron or 0)
    optimized_runs_count = int(req.optimized_runs_count or 0)
    greenest_window = _normalize_greenest_window(req.top_solar_hour)
    onboarding = _is_onboarding_user(req)

    return f"""You are WattAssistant, the smart AI energy advisor inside WattWise.
Generate a concise, 2-sentence executive briefing for the user based on their performance data.
Do not use Markdown formatting. Write in natural English only.

[USER METRICS DATA]:
- Name: {req.user_name}
- Type: {req.user_type}
- Total CO2 Avoided: {co2_avoided} kg
- Total Money Saved: {money_saved} RON
- Optimized Runs: {optimized_runs_count}
- Active schedules today: {req.active_schedules_count}
- Greenest Energy Peak Window Today: {greenest_window}

[GENERATION RULES]:
RULE A: IF `optimized_runs_count == 0` OR (`co2_avoided == 0` AND `money_saved == 0`):
- DO NOT congratulate the user for zero metrics!
- Instead, generate a warm, motivational WELCOME / ONBOARDING message.
- Explain in 1 sentence how WattWise helps them cut carbon and energy costs.
- End with a direct recommendation: "Get started today by scheduling your flexible appliances {greenest_window} when grid energy is cleanest!"

RULE B: IF `co2_avoided > 0` OR `money_saved > 0`:
- Congratulate the user with their REAL metrics: "Great job! You've avoided {co2_avoided:.1f} kg of CO2 and saved {money_saved:.2f} RON so far."
- Provide the next actionable tip: "Today, run your high-power appliances {greenest_window} to maximize your eco-impact."

Active rule for this request: {"RULE A (onboarding / first-time user)" if onboarding else "RULE B (returning user with real savings)"}.
Follow that rule strictly."""


@router.post("/briefing")
def generate_executive_briefing(req: BriefingRequest):
    system_prompt = build_briefing_system_prompt(req)
    user_prompt = (
        f"Write the executive briefing now for {req.user_name}. "
        "Keep it to exactly 2 sentences."
    )

    try:
        if client is None:
            raise RuntimeError("GROQ_API_KEY is not configured")
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            model=groq_model,
            temperature=0.6,
            max_tokens=150,
        )
        return {"briefing": get_response_text(response)}
    except Exception:
        return {"briefing": briefing_fallback(req)}


@router.post("/chat")
def chat_with_assistant(req: ChatRequest):
    context = req.context or {}
    appliances_list = context.get("appliances_raw") or []
    if not isinstance(appliances_list, list):
        appliances_list = []

    system_context = f"""
     You are WattAssistant, the autonomous assistant for WattWise.
     Provide brief, clear, and friendly responses in English.

     USER'S AVAILABLE APPLIANCES:
     {context.get('appliances')}

     ACTIVE SCHEDULED TASKS:
     {context.get('scheduled_tasks')}

     USER SAVINGS:
     - CO2 saved: {context.get('saved_co2_kg', 0)} kg
     - Money saved: {context.get('saved_money_ron', 0)} RON

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
        if client is None:
            raise RuntimeError("GROQ_API_KEY is not configured")
        response = client.chat.completions.create(
            messages=messages,
            model=groq_model,
            temperature=0.4,
            max_tokens=250
        )
        reply = get_response_text(response)
    except Exception:
        # Never 500 during a live demo — fall back to deterministic keyword replies
        reply = keyword_fallback(req.message, context)

    suggested_action = None
    for app in appliances_list:
        if not isinstance(app, dict):
            continue
        app_name = app.get("name", "")
        if not app_name:
            continue
        if app_name.lower() in req.message.lower() or app_name.lower() in reply.lower():
            time_match = re.search(r"\b([0-1]?[0-9]|2[0-3]):00\b", reply)
            target_time = time_match.group(0) if time_match else "13:00"
            suggested_action = {
                "type": "SCHEDULE_APPLIANCE",
                "applianceId": app.get("id"),
                "applianceName": app_name,
                "time": target_time,
                "durationHours": app.get("preferredDuration") or 2,
                "label": f"Schedule {app_name} at {target_time}",
            }
            break

    return {
        "reply": reply,
        "action": suggested_action
    }
