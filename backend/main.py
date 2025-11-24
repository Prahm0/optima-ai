from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

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
    subjects: list[str]
    deadlines: list[str]
    sport: str
    sleep_goal: str

@app.post("/schedule")
def generate_schedule(request: ScheduleRequest):
    # Dummy schedule for MVP
    return {
        "morning": "Math 8-9am",
        "midday": "Science 10-11am",
        "afternoon": f"{request.sport} 3-4pm",
        "evening": f"Sleep at {request.sleep_goal}"
    }
