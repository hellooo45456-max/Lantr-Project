"use client";

import { useEffect, useState } from "react";

function formatElapsed(milliseconds = 0) {
  const seconds = Math.floor(milliseconds / 1000);
  return String(Math.floor(seconds / 60)) + ":" + String(seconds % 60).padStart(2, "0");
}

function OpportunityCard({ opportunity, children }) {
  return <article className="opportunity-card">
    <p>{opportunity.status === "new" ? "AWAITING YOUR REVIEW" : "APPROVED OPPORTUNITY"}</p>
    <h2>{opportunity.title}</h2>
    {opportunity.why_it_fits && <dl><div><dt>Why it fits</dt><dd>{opportunity.why_it_fits}</dd></div></dl>}
    {opportunity.source_excerpt && <blockquote>“{opportunity.source_excerpt}”</blockquote>}
    <a className="source-link" href={opportunity.url} target="_blank" rel="noreferrer">Open official source <span>↗</span></a>
    {children}
  </article>;
}

export default function OpportunitiesPage() {
  const [password, setPassword] = useState("");
  const [approved, setApproved] = useState([]);
  const [pending, setPending] = useState([]);
  const [reviewUnlocked, setReviewUnlocked] = useState(false);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const request = async (body) => {
    const response = await fetch("/api/opportunities", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, password }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  };

  const loadOpportunities = async (reviewPassword = "") => {
    const response = await fetch("/api/opportunities", { cache: "no-store", headers: reviewPassword ? { "x-site-password": reviewPassword } : {} });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load opportunities.");
    setApproved(data.opportunities || []);
    const unlocked = Array.isArray(data.newOpportunities);
    setReviewUnlocked(unlocked);
    setPending(unlocked ? data.newOpportunities : []);
    return unlocked;
  };

  useEffect(() => {
    loadOpportunities().catch((reason) => setError(reason.message));
  }, []);

  const unlockReview = async () => {
    setError("");
    try {
      if (!await loadOpportunities(password)) setError("Incorrect site password.");
    } catch (reason) {
      setError(reason.message);
    }
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
    try { setJob(await request({ action: "cancel", id: job.id })); } catch (reason) { setError(reason.message); }
  };

  const decide = async (opportunity, status) => {
    const before = pending;
    setError("");
    setPending((items) => items.filter((item) => item.id !== opportunity.id));
    if (status === "approved") setApproved((items) => [{ ...opportunity, status, decided_at: new Date().toISOString() }, ...items]);
    try {
      const data = await request({ action: "decide", id: opportunity.id, status });
      if (status === "approved") setApproved((items) => [data.opportunity, ...items.filter((item) => item.id !== opportunity.id)]);
    } catch (reason) {
      setPending(before);
      if (status === "approved") setApproved((items) => items.filter((item) => item.id !== opportunity.id));
      setError(reason.message);
    }
  };

  useEffect(() => {
    if (!job || job.status !== "running") return undefined;
    const poll = async () => {
      try {
        const nextJob = await request({ action: "status", id: job.id });
        setJob(nextJob);
        if (nextJob.status === "completed") await loadOpportunities(password);
      } catch (reason) {
        setError(reason.message);
      }
    };
    void poll();
    const interval = window.setInterval(poll, 1000);
    return () => window.clearInterval(interval);
  }, [job?.id, job?.status, password]);

  return <main className="opportunities-page">
    <header className="opportunities-header"><a className="wordmark" href="/">JAYDEN <span>ZHENG</span></a><a className="back-link" href="/">← Back to home</a></header>
    <section className="opportunities-hero">
      <p className="eyebrow">CURRENTLY OPEN / CHECKED FOR YOU</p><h1>Good things to<br /><em>try next.</em></h1><p>Fresh opportunities for drawing, music, swimming and running — only included after the agent reads the source and checks the match.</p>
      <div className="opportunities-controls"><label>Site password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" autoComplete="current-password" /></label><button className="button button-dark" type="button" onClick={unlockReview}>Review new opportunities <span>↗</span></button><button className="button button-dark" type="button" onClick={refresh} disabled={refreshing || job?.status === "running"}>{refreshing ? "Starting…" : job?.status === "running" ? "Searching…" : "Refresh opportunities"} <span>↗</span></button></div>
      {error && <p className="opportunities-error" role="alert">{error}</p>}
    </section>
    {job && <section className="job-panel" aria-live="polite"><div className="job-panel-heading"><div><p className="eyebrow">LIVE AGENT ACTIVITY</p><h2>{job.status === "running" ? "Looking carefully." : job.status === "completed" ? "Search complete." : "Search stopped."}</h2></div><div className="elapsed"><span>ELAPSED</span><b>{formatElapsed(job.elapsedMs)}</b></div></div><div className="progress-grid"><div><b>{job.searches}</b><span>searches</span></div><div><b>{job.pageReads}</b><span>source pages read</span></div><div><b>{job.pageReads ? "Checking" : "Preparing"}</b><span>age · location · open now</span></div></div>{job.status === "running" && <button className="cancel-button" type="button" onClick={cancel}>Cancel this search</button>}{job.error && <p className="opportunities-error" role="alert">{job.error}</p>}</section>}
    {reviewUnlocked && <section className="results-section review-section"><p className="eyebrow">YOUR REVIEW QUEUE</p><h2>Decide at a glance.</h2>{pending.length ? <div className="opportunity-grid">{pending.map((opportunity) => <OpportunityCard opportunity={opportunity} key={opportunity.id}><div className="review-actions"><button className="button button-dark" type="button" onClick={() => decide(opportunity, "approved")}>Approve</button><button className="button reject-button" type="button" onClick={() => decide(opportunity, "rejected")}>Reject</button></div></OpportunityCard>)}</div> : <p className="empty-state">No new opportunities to review.</p>}</section>}
    <section className="results-section"><p className="eyebrow">APPROVED OPPORTUNITIES</p><h2>Ready to explore.</h2>{approved.length ? <div className="opportunity-grid">{approved.map((opportunity) => <OpportunityCard opportunity={opportunity} key={opportunity.id} />)}</div> : <p className="empty-state">No approved opportunities yet.</p>}</section>
  </main>;
}
