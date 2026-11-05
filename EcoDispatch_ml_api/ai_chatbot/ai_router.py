import json
import logging
import os
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

try:
    from groq import Groq
except ImportError:
    Groq = None

router = APIRouter(prefix="/api/ai")
logger = logging.getLogger("wattwise.ai_chat")

CHAT_UNAVAILABLE_REPLY = (
    "I'm WattAssistant, but I can't reach the energy AI service right now. "
    "Please try again in a moment — I'll be happy to help with solar, batteries, "
    "bills, net-billing, or appliance timing."
)
CHAT_MISSING_KEY_REPLY = (
    "I'm WattAssistant, but Groq is not configured yet. "
    "Add your GROQ_API_KEY to the project .env file and restart the ml-api container."
)


def _groq_model() -> str:
    # llama-3.1-8b-instant was decommissioned on Groq; gpt-oss-20b is currently available.
    return os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b")


def get_groq_client():
    """Resolve the Groq client from the current environment (supports live .env updates)."""
    if Groq is None:
        return None
    api_key = (os.environ.get("GROQ_API_KEY") or "").strip()
    if not api_key:
        return None
    return Groq(api_key=api_key)


def get_response_text(response):
    text = (response.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError("Groq returned an empty response")
    return text


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    user_id: int
    message: str
    context: Dict[str, Any] = Field(default_factory=dict)
    history: Optional[List[ChatMessage]] = None


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
        groq_client = get_groq_client()
        if groq_client is None:
            raise RuntimeError("GROQ_API_KEY is not configured")
        response = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            model=_groq_model(),
            temperature=0.6,
            max_tokens=1000,
        )
        return {"briefing": get_response_text(response)}
    except Exception as ex:
        logger.warning("Briefing LLM unavailable: %s", ex)
        return {"briefing": briefing_fallback(req)}


def _appliance_catalog(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    appliances = context.get("appliances_raw") or []
    if not isinstance(appliances, list):
        return []
    catalog = []
    for app in appliances:
        if not isinstance(app, dict):
            continue
        name = app.get("name")
        if not name:
            continue
        duration = app.get("preferredDuration") or app.get("preferred_duration") or 2
        try:
            duration_h = int(float(duration))
        except (TypeError, ValueError):
            duration_h = 2
        catalog.append({
            "id": app.get("id"),
            "name": name,
            "powerKw": app.get("powerConsumptionKw") or app.get("power_consumption_kw"),
            "preferredDurationHours": max(1, duration_h),
            "isRecurring": bool(app.get("isRecurring") or app.get("is_recurring")),
        })
    return catalog


def build_chat_system_prompt(context: Dict[str, Any], catalog: List[Dict[str, Any]]) -> str:
    location = context.get("location_name") or "Romania"
    peak = context.get("solar_peak_window") or "13:00-15:00"
    user_info = context.get("user_info") or "WattWise user"
    solar_kw = context.get("solar_kw")
    solar_line = (
        f"- Live / estimated solar output right now: {solar_kw} kW"
        if solar_kw is not None
        else "- Live solar output: not available"
    )
    catalog_json = json.dumps(catalog, ensure_ascii=False) if catalog else "[]"

    return f"""You are WattAssistant — a brilliant, friendly home-energy advisor inside the WattWise chat UI.
Write like a modern mobile chat assistant: clean, scannable, and conversational — never like a textbook or a long FAQ.

FORMATTING (critical for chat UI — never break these):
- Use short natural paragraphs only (about 1–3 sentences each). Prefer 2–4 paragraphs total.
- Do NOT use long numbered or bulleted lists (no "1. 2. 3. … 19. 20."). Avoid markdown bold mini-headings stacked as tips.
- If a topic is complex (EV charging, solar sizing, batteries), weave the points into flowing sentences instead of enumerations.
- Keep the full reply concise enough to finish completely — aim for roughly 80–180 words. Never trail off mid-sentence or mid-list.
- Skip walls of text. Lead with the useful answer, then one short supporting paragraph if needed.
- Do not dump every metric from context unless the user asked for numbers.

PERSONA:
- Warm, expert, human (ChatGPT/Gemini style). Direct and clear, not formal or bureaucratic.
- Vary phrasing across turns; never recycle a canned tip dump.

LANGUAGE (mandatory — highest priority):
- Mirror ONLY the language of the user's latest message. English in → English out. Romanian in → Romanian out.
- Do NOT switch to Romanian (or any other language) because the location is Romania, the city is Sibiu, the currency is RON, or earlier turns used another language.
- Do NOT mix languages in one reply (no "Hey cineva!" / "Bună!" inside an English answer).
- If history is mixed-language, still follow the latest user message only.

DOMAIN SCOPE:
- Discuss freely: electricity, home bills & tariffs, solar PV & inverters, LiFePO4 / home batteries, net-billing / export, carbon footprint, sustainability, power grids (including Romania's SEN), and WattWise appliance scheduling.
- Use USER CONTEXT when it genuinely helps (location, savings, solar window, appliances) — weave it in naturally.
- Off-topic (coding, recipes, sports, gossip): politely decline and pivot back to energy/sustainability in the user's language.

SCHEDULING ACTIONS (no appliance spam):
- Do NOT push scheduling or default to any appliance (including washing machines).
- For general energy questions, end with ACTION_JSON: null.
- Emit non-null ACTION_JSON ONLY when the user explicitly asks to run/start/schedule a specific catalog appliance.
- When scheduling: give HH:MM, durationHours, and a short reason in the prose, then the ACTION_JSON line.

USER CONTEXT:
- User: {user_info}
- Location / city: {location}
- CO₂ avoided so far: {context.get('saved_co2_kg', 0)} kg
- Money saved so far: {context.get('saved_money_ron', 0)} RON
- Active schedules: {context.get('scheduled_tasks') or 'none'}
- Cleaner energy / solar-leaning window today: {peak}
{solar_line}
- User's appliances (JSON catalog — only schedule devices from here): {catalog_json}

OUTPUT FORMAT (mandatory):
1) Write the conversational reply first (short paragraphs, complete ending).
2) On the very last line, output exactly one of:
   ACTION_JSON: null
   OR
   ACTION_JSON: {{"type":"SCHEDULE_APPLIANCE","applianceId":<id from catalog>,"applianceName":"<exact catalog name>","time":"HH:MM","durationHours":<number>,"autoSchedule":true,"reason":"<short reason>"}}
"""


def _parse_action_json(raw_reply: str) -> tuple[str, Optional[Dict[str, Any]]]:
    if not raw_reply:
        return "", None
    match = re.search(r"ACTION_JSON:\s*(null|\{.*\})\s*$", raw_reply, re.IGNORECASE | re.DOTALL)
    if not match:
        alt = re.search(r"(\{\s*\"type\"\s*:\s*\"SCHEDULE_APPLIANCE\".*\})\s*$", raw_reply, re.DOTALL)
        if not alt:
            return raw_reply.strip(), None
        payload = alt.group(1)
        reply = raw_reply[: alt.start()].strip()
    else:
        payload = match.group(1).strip()
        reply = raw_reply[: match.start()].strip()

    if payload.lower() == "null":
        return reply, None
    try:
        data = json.loads(payload)
        if isinstance(data, dict) and data.get("type") == "SCHEDULE_APPLIANCE":
            return reply, data
    except json.JSONDecodeError:
        pass
    return reply or raw_reply.strip(), None


def _parse_hhmm(value: Optional[str]) -> Optional[tuple[int, int]]:
    if not value:
        return None
    m = re.search(r"\b([0-1]?\d|2[0-3])[:.]([0-5]\d)\b", str(value))
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def _build_start_iso(time_str: Optional[str], default_hour: int = 14, default_minute: int = 30) -> str:
    now = datetime.now()
    parsed = _parse_hhmm(time_str)
    hour, minute = parsed if parsed else (default_hour, default_minute)
    start = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if start <= now:
        start = start + timedelta(days=1)
    return start.strftime("%Y-%m-%dT%H:%M:%S")


def _resolve_catalog_appliance(
    catalog: List[Dict[str, Any]],
    llm_action: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Map LLM action ids/names onto the user's real appliance catalog."""
    by_id = llm_action.get("applianceId")
    if by_id is not None:
        for app in catalog:
            if str(app.get("id")) == str(by_id):
                return app

    name = (llm_action.get("applianceName") or "").strip().lower()
    if not name:
        return None

    for app in catalog:
        catalog_name = (app.get("name") or "").lower()
        if catalog_name and (name == catalog_name or name in catalog_name or catalog_name in name):
            return app
    return None


def build_suggested_action(
    context: Dict[str, Any],
    catalog: List[Dict[str, Any]],
    llm_action: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Trust the LLM: only surface a schedule button when ACTION_JSON is present and valid."""
    if not llm_action or llm_action.get("type") != "SCHEDULE_APPLIANCE":
        return None
    if not catalog:
        return None

    app = _resolve_catalog_appliance(catalog, llm_action)
    if app is None:
        return None

    time_hint = llm_action.get("time") or llm_action.get("startTime")
    if not time_hint:
        peak = str(context.get("solar_peak_window") or "14:30")
        time_hint = peak.split("-")[0].strip() if "-" in peak else peak

    duration = app.get("preferredDurationHours") or 2
    if llm_action.get("durationHours") is not None:
        try:
            duration = max(1, int(float(llm_action["durationHours"])))
        except (TypeError, ValueError):
            pass

    start_iso = _build_start_iso(str(time_hint))
    display_time = start_iso[11:16]
    reason = llm_action.get("reason") or "Optimal energy window"
    location = context.get("location_name")
    if location and "reason" not in (llm_action or {}):
        reason = f"Cleaner energy window in {location}"

    return {
        "type": "SCHEDULE_APPLIANCE",
        "applianceId": app.get("id"),
        "applianceName": app.get("name"),
        "time": display_time,
        "startTime": start_iso,
        "durationHours": duration,
        "autoSchedule": True,
        "reason": reason,
        "label": f"Auto-Schedule {app.get('name')} at {display_time}",
    }


@router.post("/chat")
def chat_with_assistant(req: ChatRequest):
    context = req.context or {}
    catalog = _appliance_catalog(context)

    system_prompt = build_chat_system_prompt(context, catalog)
    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]

    if req.history:
        for item in req.history[-8:]:
            role = "assistant" if item.role in ("ai", "assistant") else "user"
            content = (item.content or "").strip()
            if content:
                messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": req.message})

    try:
        groq_client = get_groq_client()
        if groq_client is None:
            logger.error("Chat unavailable: GROQ_API_KEY is empty / missing")
            return {
                "reply": CHAT_MISSING_KEY_REPLY,
                "action": None,
                "suggestedAction": None,
            }
        response = groq_client.chat.completions.create(
            messages=messages,
            model=_groq_model(),
            temperature=0.7,
            max_tokens=500,
        )
        raw = get_response_text(response)
        reply, llm_action = _parse_action_json(raw)
        if not reply:
            reply = raw
    except Exception as ex:
        logger.exception("Chat LLM call failed: %s", ex)
        return {
            "reply": CHAT_UNAVAILABLE_REPLY,
            "action": None,
            "suggestedAction": None,
        }

    suggested = build_suggested_action(context, catalog, llm_action)
    reply = re.sub(r"\n?ACTION_JSON:.*$", "", reply, flags=re.IGNORECASE | re.DOTALL).strip()

    return {
        "reply": reply,
        "action": suggested,
        "suggestedAction": suggested,
    }
