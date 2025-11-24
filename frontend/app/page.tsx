"use client"; // needed for client-side interactivity
import { useState } from "react";

export default function Home() {
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
      const res = await fetch("http://127.0.0.1:8000/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjects: subjects.split(",").map((s) => s.trim()).filter(Boolean),
          deadlines: deadlines.split(",").map((d) => d.trim()).filter(Boolean),
          sport,
          sleep_goal: sleepGoal,
        }),
      });

      if (!res.ok) throw new Error("Backend returned error");
      const data = await res.json();
      setSchedule(data);
    } catch (err) {
      console.error(err);
      alert("Failed to generate schedule. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-slate-50 flex justify-center items-start">
      <div className="max-w-3xl w-full bg-white shadow-md rounded-lg p-6">
        <h1 className="text-2xl font-semibold mb-4">Optima AI — Generate your schedule</h1>

        <form onSubmit={handleGenerate} className="space-y-3">
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
              }}
            >
              Reset
            </button>
          </div>
        </form>

        {schedule && (
          <section className="mt-6">
            <h2 className="text-lg font-medium mb-2">Your schedule</h2>
            <div className="space-y-2">
              {Object.entries(schedule).map(([k, v]) => (
                <div key={k} className="p-3 border rounded bg-slate-50">
                  <div className="text-sm text-slate-500">{k}</div>
                  <div className="text-base">{v}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
