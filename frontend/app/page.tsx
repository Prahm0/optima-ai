"use client"; // needed for client-side interactivity
import { useState } from "react";

export default function Home() {
  const [freeform, setFreeform] = useState("");
  const [subjects, setSubjects] = useState("");
  const [deadlines, setDeadlines] = useState("");
  const [sport, setSport] = useState("");
  const [sleepGoal, setSleepGoal] = useState("");
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let scheduleData;

      if (freeform.trim()) {
        // 1️⃣ Parse freeform input
        const parseRes = await fetch("http://127.0.0.1:8000/parse_input", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: freeform }),
        });

        if (!parseRes.ok) throw new Error("Failed to parse freeform text");
        scheduleData = await parseRes.json();

      } else {
        // 2️⃣ Use manual input fields
        scheduleData = {
          subjects: subjects.split(",").map((s) => s.trim()).filter(Boolean),
          deadlines: deadlines.split(",").map((d) => d.trim()).filter(Boolean),
          sport,
          sleep_goal: sleepGoal,
        };
      }

      // 3️⃣ Generate schedule
      const scheduleRes = await fetch("http://127.0.0.1:8000/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduleData),
      });

      if (!scheduleRes.ok) throw new Error("Failed to generate schedule");
      const finalData = await scheduleRes.json();
      setSchedule(finalData);

    } catch (err) {
      console.error(err);
      alert("Error generating schedule. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };


  return (
    <main className="min-h-screen bg-slate-50 w-screen">
      <div className="w-full max-w-4xl mx-auto px-4 md:px-6 min-w-full">
        <h1 className="text-2xl font-semibold mb-4">Optima AI — Generate your schedule</h1>

       <form onSubmit={handleGenerate} className="space-y-6 w-full flex-grow min-w-full" id="schedule-form-override">
          {/* Freeform box */}
          <div className="w-full">
            <textarea
              className="w-full p-4 border rounded h-48 md:h-64 resize-y focus:ring-2 focus:ring-blue-400 focus:outline-none"
              placeholder="Or enter freeform plan (e.g., Math exam Monday, gym Tue 4pm)"
              value={freeform}
              onChange={(e) => setFreeform(e.target.value)}
            />
          </div>

          {/* Manual inputs — only shown if freeform is empty */}
          {freeform.trim() === "" && (
            <div className="space-y-3">
              <input
                className="w-full p-3 border rounded"
                placeholder="Subjects (comma separated, e.g. Math, Physics)"
                value={subjects}
                onChange={(e) => setSubjects(e.target.value)}
              />
              <input
                className="w-full p-3 border rounded"
                placeholder="Deadlines (comma separated or leave blank)"
                value={deadlines}
                onChange={(e) => setDeadlines(e.target.value)}
              />
              <input
                className="w-full p-3 border rounded"
                placeholder="Sport (e.g. Football 3-4pm)"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
              />
              <input
                className="w-full p-3 border rounded"
                placeholder="Sleep goal (e.g. 10:30 PM)"
                value={sleepGoal}
                onChange={(e) => setSleepGoal(e.target.value)}
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
              {loading ? "Generating…" : "Generate Schedule"}
            </button>
            <button
              type="button"
              className="px-4 py-2 border rounded"
              onClick={() => {
                setSubjects("");
                setDeadlines("");
                setSport("");
                setSleepGoal("");
                setSchedule(null);
                setFreeform("");
              }}
            >
              Reset
            </button>
          </div>
        </form>


        {schedule && (
          <section className="mt-6">
            <h2 className="text-lg font-medium mb-4">Your 7-day plan</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(schedule)
                .filter(([key]) => key !== "_meta")
                .map(([dateKey, dayPlan]) => (
                  <div key={dateKey} className="p-4 border rounded bg-white shadow-sm">
                    <div className="text-sm text-slate-500 mb-2">
                      {new Date(dateKey).toDateString()}
                    </div>

                    <div className="space-y-2">
                      {Object.entries(dayPlan || {}).map(([slotKey, slotValue]) => (
                        <div key={slotKey} className="p-2 border rounded bg-slate-50">
                          <div className="text-xs text-slate-500">{slotKey}</div>
                          <div className="text-sm">{String(slotValue)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            {schedule["_meta"] && (
              <div className="mt-4 text-xs text-slate-400">
                Generated at: {String(schedule["_meta"]?.generated_at)}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
