"use client";
import { useEffect, useMemo, useState } from "react";
import PrivateFeedbackGallery from "../private-feedback-gallery";
import "./feedback-admin.css";
import "./feedback-admin-refinements.css";
import {networkError} from "../request-errors";

const API = process.env.NEXT_PUBLIC_API_URL || "https://api.feather-map.com";
const titleCase = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
async function call(path: string, token: string, options: RequestInit = {}) {
  let response:Response;
  try{response = await fetch(`${API}${path}`, {...options,headers: {Authorization: `Bearer ${token}`,"Content-Type": "application/json",...options.headers}})}
  catch(cause){throw networkError("admin",cause)}
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
function AssociationPicker({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: { id: string; label: string; detail: string }[];
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.id === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options
      .filter((option) => !needle || `${option.label} ${option.detail}`.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [options, query]);
  return (
    <div className="association-picker">
      <label>{label}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={selected?.label || placeholder} aria-label={`Search ${label.toLowerCase()}`} /></label>
      {selected && <div className="association-selected"><span><b>{selected.label}</b><small>{selected.detail}</small></span><button onClick={() => onChange("")}>Clear</button></div>}
      {query && <div className="association-results">{filtered.length ? filtered.map((option) => <button key={option.id} onClick={() => { onChange(option.id); setQuery(""); }}><b>{option.label}</b><small>{option.detail}</small></button>) : <p>No matches found.</p>}</div>}
    </div>
  );
}

export default function FeedbackAdmin({ visible, token }: { visible: boolean; token: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("active");
  const [category, setCategory] = useState("all");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  async function load() {
    if (!visible || !token) return;
    setMessage("Loading feedback…");
    try {
      const data = await call(`/api/admin/feedback?status=${statusFilter}&category=${category}`, token);
      setItems(data.feedback || []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load feedback");
    }
  }
  useEffect(() => { void load(); }, [visible, token, statusFilter, category]);
  async function open(id: string) {
    setMessage("Loading feedback…");
    try {
      setSelected(await call(`/api/admin/feedback/${id}`, token));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load feedback");
    }
  }
  async function save() {
    if (!selected) return;
    setBusy(true);
    setMessage("Saving…");
    try {
      await call(`/api/admin/feedback/${selected.feedback.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          status: selected.feedback.status,
          priority: selected.feedback.priority,
          assigned_to: selected.feedback.assigned_to || null,
          duplicate_of: selected.feedback.duplicate_of || null,
          resolution_summary: selected.feedback.resolution_summary || "",
        }),
      });
      await open(selected.feedback.id);
      await load();
      setMessage("Saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save feedback");
    } finally {
      setBusy(false);
    }
  }
  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      await call(`/api/admin/feedback/${selected.feedback.id}/messages`, token, {
        method: "POST",
        body: JSON.stringify({ body: reply, internal }),
      });
      setReply("");
      await open(selected.feedback.id);
      setMessage(internal ? "Internal note saved" : "Response sent");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send response");
    } finally {
      setBusy(false);
    }
  }
  if (!visible) return null;
  const staffOptions = (selected?.options?.staff || []).map((person: any) => ({
    id: person.id,
    label: person.display_name,
    detail: (person.roles || []).map(titleCase).join(", "),
  }));
  const duplicateOptions = (selected?.options?.duplicates || []).map((item: any) => ({
    id: item.id,
    label: item.title,
    detail: `${titleCase(item.category)} · ${titleCase(item.status)} · ${item.submitted_by_name} · ${new Date(item.created_at).toLocaleDateString()}`,
  }));
  return (
    <section className="feedback-admin">
      <header><div><h2>Product feedback</h2><p>Private bug reports, feature requests, usability concerns, and data corrections.</p></div><button onClick={load}>Refresh</button></header>
      <div className="feedback-admin-filters">
        <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">Active</option><option value="all">All History</option><option value="new">New</option><option value="planned">Planned</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="declined">Declined</option><option value="duplicate">Duplicate</option></select></label>
        <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All Categories</option><option value="bug">Bugs</option><option value="feature">Feature Requests</option><option value="usability">Usability</option><option value="data">Data Corrections</option><option value="safety_privacy">Safety and Privacy</option><option value="other">Other</option></select></label>
      </div>
      {message && <div className="admin-notice">{message}</div>}
      <div className="feedback-admin-list">
        {items.length ? items.map((item) => <article key={item.id}><span><em>{titleCase(item.category)}</em><button className="detail-title" onClick={() => open(item.id)}>{item.title}</button><small>{item.submitted_by_name} · {new Date(item.created_at).toLocaleString()}</small></span><span className={`feedback-admin-status status-${item.status}`}>{titleCase(item.status)}</span><strong className={`priority-${item.priority}`}>{titleCase(item.priority)}</strong><button onClick={() => open(item.id)}>Open details</button></article>) : <p>No feedback matches these filters.</p>}
      </div>
      {selected && <div className="admin-overlay" onClick={() => setSelected(null)}>
        <section className="admin-detail feedback-admin-detail" onClick={(event) => event.stopPropagation()}>
          <button className="detail-close" onClick={() => setSelected(null)} aria-label="Close feedback details">×</button>
          <span className="case-type">{titleCase(selected.feedback.category)} · {titleCase(selected.feedback.status)}</span>
          <h2>{selected.feedback.title}</h2>
          <p>Submitted by {[selected.feedback.submitter?.first_name, selected.feedback.submitter?.last_name?.[0] && `${selected.feedback.submitter.last_name[0]}.`].filter(Boolean).join(" ") || selected.feedback.submitter?.display_name || "Member"} on {new Date(selected.feedback.created_at).toLocaleString()}</p>
          <div className="feedback-admin-grid">
            <section>
              <h3>Description</h3><div className="feedback-original">{selected.feedback.description}</div>
              {selected.attachments?.length > 0 && <PrivateFeedbackGallery attachments={selected.attachments} token={token} />}
              <h3>Conversation</h3>
              <div className="feedback-admin-thread">{selected.messages?.map((item: any) => <article className={item.internal ? "internal" : ""} key={item.id}><b>{item.internal ? "Internal Staff Note" : item.author_id === selected.feedback.submitted_by ? "User" : "Staff Response"}</b><time>{new Date(item.created_at).toLocaleString()}</time><p>{item.body}</p></article>)}</div>
              <div className="feedback-admin-reply"><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder={internal ? "Internal note—never shown to the user" : "Response visible to the user"} /><label><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /> Internal Note</label><button className="primary feedback-response-button" disabled={busy || !reply.trim()} onClick={sendReply}>{busy ? "Sending…" : internal ? "Save Note" : "Send Response"}</button></div>
            </section>
            <aside>
              <h3>Workflow</h3>
              <label>Status<select value={selected.feedback.status} onChange={(event) => setSelected({ ...selected, feedback: { ...selected.feedback, status: event.target.value } })}>{["new", "reviewing", "planned", "in_progress", "needs_information", "resolved", "declined", "duplicate"].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
              <label>Priority<select value={selected.feedback.priority} onChange={(event) => setSelected({ ...selected, feedback: { ...selected.feedback, priority: event.target.value } })}>{["low", "normal", "high", "urgent"].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
              <div className="association-quick-actions"><button onClick={() => setSelected({ ...selected, feedback: { ...selected.feedback, assigned_to: selected.options.current_user_id } })}>Assign to Me</button><button onClick={() => setSelected({ ...selected, feedback: { ...selected.feedback, assigned_to: "" } })}>Unassigned</button></div>
              <AssociationPicker label="Assigned Staff" value={selected.feedback.assigned_to || ""} options={staffOptions} onChange={(value) => setSelected({ ...selected, feedback: { ...selected.feedback, assigned_to: value } })} placeholder="Search staff by name or role" />
              <AssociationPicker label="Duplicate Of" value={selected.feedback.duplicate_of || ""} options={duplicateOptions} onChange={(value) => setSelected({ ...selected, feedback: { ...selected.feedback, duplicate_of: value, status: value ? "duplicate" : selected.feedback.status } })} placeholder="Search feedback by title, user, or status" />
              <label>Resolution Summary<textarea value={selected.feedback.resolution_summary || ""} onChange={(event) => setSelected({ ...selected, feedback: { ...selected.feedback, resolution_summary: event.target.value } })} /></label>
              <button className="primary feedback-save" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save Workflow"}</button>
              <details><summary>Safe Diagnostics</summary><dl>{Object.entries(selected.feedback.diagnostics || {}).map(([key, value]) => <div className="diagnostic-row" key={key}><dt>{titleCase(key)}</dt><dd>{String(value ?? "Not Provided")}</dd></div>)}</dl></details>
            </aside>
          </div>
        </section>
      </div>}
    </section>
  );
}
