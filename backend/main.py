from fastapi import FastAPI
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, date
from fastapi import HTTPException, Body
import os
import openai
import json

# Open AI API key setup
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI()

# Allow frontend to communicate
origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScheduleRequest(BaseModel):
    subjects: List[str]
    deadlines: Optional[List[Optional[str]]] = None  # allow missing deadlines
    sport: Optional[str] = ""
    sleep_goal: Optional[str] = ""

# ---- Utility: parse loose deadline strings into a date or None ----
def parse_deadline(d: Optional[str]) -> Optional[date]:
    if not d or not d.strip():
        return None
    s = d.strip()
    today = date.today()

    # 1) Try ISO format first (YYYY-MM-DD)
    try:
        return datetime.fromisoformat(s).date()
    except Exception:
        pass

    # 2) Try DD/MM or DD/MM/YYYY
    parts = s.replace("-", "/").split("/")
    try:
        if len(parts) == 2:
            day = int(parts[0])
            month = int(parts[1])
            year = today.year
            parsed = date(year, month, day)
            # if date already passed this year, assume next year
            if parsed < today:
                parsed = date(year + 1, month, day)
            return parsed
        elif len(parts) == 3:
            day = int(parts[0])
            month = int(parts[1])
            year = int(parts[2])
            # handle two-digit year like 25 -> 2025
            if year < 100:
                year += 2000
            return date(year, month, day)
    except Exception:
        return None

    # 3) Try common textual months like "25 Nov 2025" using datetime fallback
    for fmt in ("%d %b %Y", "%d %B %Y", "%d %b", "%d %B"):
        try:
            parsed_dt = datetime.strptime(s, fmt)
            parsed_date = parsed_dt.date()
            if parsed_date.year == 1900:
                parsed_date = parsed_date.replace(year=today.year)
                if parsed_date < today:
                    parsed_date = parsed_date.replace(year=today.year + 1)
            return parsed_date
        except Exception:
            continue

    # If all fails
    return None

# ---- Scheduler logic: produce a 7-day plan ----
def make_7_day_plan(subjects: List[str], deadlines: Optional[List[Optional[str]]], sport: Optional[str], sleep_goal: Optional[str]) -> Dict[str, Any]:
    # Basic slots per day
    slots = [
        ("morning", "08:00-10:00"),
        ("midday", "10:30-12:00"),
        ("afternoon", "15:00-17:00"),
    ]

    # Parse deadlines into dates aligned with subjects
    parsed_deadlines: List[Optional[date]] = []
    if deadlines:
        # If fewer deadlines than subjects, pad with None
        for i in range(max(len(subjects), len(deadlines))):
            if i < len(deadlines):
                parsed_deadlines.append(parse_deadline(deadlines[i]))
            else:
                parsed_deadlines.append(None)
    else:
        parsed_deadlines = [None] * len(subjects)

    # Build initial task list with priority based on deadline proximity
    tasks = []
    today = date.today()
    for i, subj in enumerate(subjects):
        dl = parsed_deadlines[i] if i < len(parsed_deadlines) else None
        if dl:
            days_to_deadline = max((dl - today).days, 0)
            # priority: nearer deadlines -> higher priority value
            priority = 1 / (days_to_deadline + 1)
        else:
            priority = 0.1  # low base priority for no-deadline items
            dl = None
        tasks.append({
            "subject": subj,
            "deadline": dl,
            "priority": priority,
            "assigned_count": 0  # how many slots we've allocated so far (used to rotate)
        })

    # Sort tasks initial by priority desc
    tasks.sort(key=lambda x: x["priority"], reverse=True)

    # Build 7-day plan structure
    plan: Dict[str, Dict[str, str]] = {}
    window_days = 7
    for day_offset in range(window_days):
        day_date = today + timedelta(days=day_offset)
        day_key = day_date.isoformat()
        # default day structure
        day_entry: Dict[str, str] = {}
        # Fill study slots greedily by highest current priority
        for slot_name, slot_time in slots:
            # pick highest priority task (tie-break by smallest assigned_count)
            tasks.sort(key=lambda t: (-t["priority"], t["assigned_count"]))
            if tasks:
                chosen = tasks[0]
                subject_name = chosen["subject"]
                day_entry[slot_name] = f"{slot_time} — {subject_name}"
                # update chosen task: increment assigned_count and slightly reduce priority
                chosen["assigned_count"] += 1
                chosen["priority"] *= 0.6  # reduce so others get chance
            else:
                day_entry[slot_name] = f"{slot_time} — Free / buffer"
        # Sport handling: if sport string contains a time, try to put it; otherwise append as note
        if sport and sport.strip():
            day_entry["sport"] = sport
        else:
            day_entry["sport"] = "No sport scheduled"
        # Sleep target as note
        day_entry["sleep"] = f"Target sleep: {sleep_goal if sleep_goal else 'Set a sleep goal'}"
        plan[day_key] = day_entry

    # Add brief metadata / priorities for debugging
    plan["_meta"] = {
        "generated_at": datetime.now().isoformat(),
        "subjects_count": len(subjects),
        "note": "This is a 7-day rotating plan prioritising nearer deadlines. Priorities are adjusted each allocation."
    }
    return plan

@app.post("/schedule")
def generate_schedule(request: ScheduleRequest):
    # Defensive: ensure lists are present
    subjects = request.subjects or []
    deadlines = request.deadlines or []
    sport = request.sport or ""
    sleep_goal = request.sleep_goal or ""

    # If no subjects provided, return a helpful default
    if not subjects:
        return {
            "message": "No subjects provided. Add subjects to generate a schedule.",
            "sleep_goal": sleep_goal,
            "sport": sport
        }

    plan = make_7_day_plan(subjects, deadlines, sport, sleep_goal)
    return plan

class FreeformInput(BaseModel):
    text: str = Field(..., example="Math exam Monday, gym Tue 4pm, English essay Friday")

class StructuredSchedule(BaseModel):
    subjects: List[str]
    deadlines: List[str]  # ISO dates
    sport: Optional[str] = None
    sleep_goal: Optional[str] = None  # HH:MM

@app.post("/parse_input", response_model=StructuredSchedule)
async def parse_input(input: FreeformInput):
    prompt = f"""
Convert the following freeform student planning text into structured JSON.
Only return JSON with these keys: subjects (array of strings), deadlines (array of ISO dates), sport (string or null), sleep_goal (HH:MM string or null).

Text:
{input.text}
"""
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        content = response.choices[0].message.content.strip()

        # Parse JSON
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail=f"LLM returned invalid JSON: {content}")

        return StructuredSchedule(**data)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

