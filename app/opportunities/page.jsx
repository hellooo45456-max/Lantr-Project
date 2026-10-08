"use client";

import { useEffect, useState } from "react";

function formatElapsed(milliseconds = 0) {
  const seconds = Math.floor(milliseconds / 1000);
  return String(Math.floor(seconds / 60)) + ":" + String(seconds % 60).padStart(2, "0");
}

export default function OpportunitiesPage() {
  const [password, setPassword] = useState("");
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const request = async (body) => {
    const response = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  };

  const refresh = async () => {
    setError("");
    setRefreshing(true);
    try {
      const data = await request({ action: "start" });
      setJob({ id: data.id, status: "running", searches: 0, pageReads: 0, elapsedMs: 0, activity: [] });
    } catch (reason) {
      setError(reason.message);
    } finally {
      setRefreshing(false);
    }
  };

  const cancel = async () => {
    if (!job) return;
    try {
      setJob(await request({ action: "cancel", id: job.id }));
    } catch (reason) {
      setError(reason.message);
    }
  };

  useEffect(() => {
    if (!job || job.status !== "running") return undefined;
    const poll = async () => {
      try {
        setJob(await request({ action: "status", id: job.id }));
      } catch (reason) {
        setError(reason.message);
      }
    };
    void poll();
    const interval = window.setInterval(poll, 1000);
    return () => window.clearInterval(interval);
  }, [job?.id, job?.status, password]);

  const results = job?.results;
  return (
    <main className="opportunities-page">
      <header className="opportunities-header">
        <a className="wordmark" href="/">JAYDEN <span>ZHENG</span></a>
        <a className="back-link" href="/">← Back to home</a>
      </header>
      <section className="opportunities-hero">
        <p className="eyebrow">CURRENTLY OPEN / CHECKED FOR YOU</p>
        <h1>Good things to<br /><em>try next.</em></h1>
        <p>Fresh opportunities for drawing, music, swimming and running — only included after the agent reads the source and checks the match.</p>
        <div className="opportunities-controls">
          <label>
            Site password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" autoComplete="current-password" />
          </label>
          <button className="button button-dark" type="button" onClick={refresh} disabled={refreshing || job?.status === "running"}>
            {refreshing ? "Starting…" : job?.status === "running" ? "Searching…" : "Refresh opportunities"} <span>↗</span>
          </button>
        </div>
        {error && <p className="opportunities-error" role="alert">{error}</p>}
      </section>

      {job && <section className="job-panel" aria-live="polite">
        <div className="job-panel-heading">
          <div><p className="eyebrow">LIVE AGENT ACTIVITY</p><h2>{job.status === "running" ? "Looking carefully." : job.status === "completed" ? "Search complete." : "Search stopped."}</h2></div>
          <div className="elapsed"><span>ELAPSED</span><b>{formatElapsed(job.elapsedMs)}</b></div>
        </div>
        <div className="progress-grid">
          <div><b>{job.searches}</b><span>searches</span></div>
          <div><b>{job.pageReads}</b><span>source pages read</span></div>
          <div><b>{job.pageReads ? "Checking" : "Preparing"}</b><span>age · location · open now</span></div>
        </div>
        {job.status === "running" && <button className="cancel-button" type="button" onClick={cancel}>Cancel this search</button>}
        {job.error && <p className="opportunities-error" role="alert">{job.error}</p>}
        <details className="activity-details">
          <summary>See searches and sources ({job.activity?.length || 0})</summary>
          <ol>
            {(job.activity || []).map((activity, index) => <li key={activity.type + "-" + activity.at + "-" + index}>
              {activity.type === "search" && <>Searching: <strong>{activity.query}</strong></>}
              {activity.type === "read" && <>Reading source: <a href={activity.url} target="_blank" rel="noreferrer">{activity.url}</a></>}
              {activity.type === "checking" && <>Checking final matches against the evidence collected.</>}
            </li>)}
          </ol>
        </details>
      </section>}

      {results && <section className="results-section">
        <p className="eyebrow">VERIFIED OPPORTUNITIES</p>
        <div className="opportunity-grid">
          {results.opportunities.map((opportunity) => <article className="opportunity-card" key={opportunity.url}>
            <p>{opportunity.organiser}</p><h2>{opportunity.title}</h2><span className="location-tag">{opportunity.location}</span>
            <dl><div><dt>Why it fits</dt><dd>{opportunity.eligibilityEvidence}</dd></div><div><dt>Availability</dt><dd>{opportunity.availabilityEvidence}</dd></div></dl>
            <blockquote>“{opportunity.sourceExcerpt}”</blockquote>
            <a className="source-link" href={opportunity.url} target="_blank" rel="noreferrer">Open official source <span>↗</span></a>
          </article>)}
        </div>
        <div className="ruled-out"><h2>What was ruled out.</h2><ul>{results.ruledOut.map((item) => <li key={item}>{item}</li>)}</ul><p>{results.note}</p></div>
      </section>}
    </main>
  );
}
