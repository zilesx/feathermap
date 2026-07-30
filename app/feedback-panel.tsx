"use client";
import { useEffect, useState } from "react";
import PrivateFeedbackGallery from "./private-feedback-gallery";
import "./feedback.css";
import "./feedback-unread.css";

const API = process.env.NEXT_PUBLIC_API_URL || "https://api.feather-map.com";
const categories = [
  ["bug", "Bug"],
  ["feature", "Feature Request"],
  ["usability", "Usability Issue"],
  ["data", "Data Correction"],
  ["safety_privacy", "Safety or Privacy"],
  ["other", "Other"],
];
const titleCase = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
async function call(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
async function safeScreenshot(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  bitmap.close();
  if (!blob) throw new Error("Could not process screenshot");
  return new File([blob], "feedback-screenshot.jpg", { type: "image/jpeg" });
}

export default function FeedbackPanel({
  token,
  onClose,
  onUnreadChange,
}: {
  token: string;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [mode, setMode] = useState<"new" | "history">("new");
  const [category, setCategory] = useState("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactAllowed, setContactAllowed] = useState(true);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const unreadCount = items.filter((item) => item.unread).length;

  async function load() {
    if (!token) return;
    try {
      const data = await call("/api/feedback", token);
      setItems(data.feedback || []);
      onUnreadChange?.(Number(data.unread_count) || 0);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load feedback");
    }
  }
  useEffect(() => {
    void load();
  }, [token]);

  async function submit() {
    if (title.trim().length < 4 || description.trim().length < 10) {
      setStatus("Add a short title and enough detail to understand the request.");
      return;
    }
    setBusy(true);
    setStatus("Sending feedback…");
    try {
      const diagnostics = includeDiagnostics
        ? {
            browser: navigator.userAgent,
            operating_system: navigator.platform,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            online: navigator.onLine,
            language: navigator.language,
          }
        : {};
      const result = await call("/api/feedback", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title,
          description,
          contact_allowed: contactAllowed,
          page_path: location.pathname,
          app_version: "web-1",
          platform: "web",
          diagnostics,
        }),
      });
      if (screenshot) {
        setStatus("Sanitizing and uploading screenshot…");
        const safe = await safeScreenshot(screenshot);
        await call(`/api/feedback/${result.feedback.id}/attachments`, token, {
          method: "POST",
          headers: { "Content-Type": safe.type },
          body: safe,
        });
      }
      setTitle("");
      setDescription("");
      setScreenshot(null);
      await load();
      setMode("history");
      await openItem(result.feedback.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not submit feedback");
    } finally {
      setBusy(false);
    }
  }
  async function openItem(id: string) {
    setStatus("Loading feedback…");
    try {
      setSelected(await call(`/api/feedback/${id}`, token));
      await call(`/api/feedback/${id}/read`, token, { method: "POST" });
      await load();
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load feedback");
    }
  }
  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      await call(`/api/feedback/${selected.feedback.id}/messages`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      setReply("");
      await openItem(selected.feedback.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send reply");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-wrap feedback-wrap" onClick={onClose}>
      <section className="modal feedback-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><span className="eyebrow">HELP IMPROVE FEATHERMAP</span><h2>Product feedback</h2></div>
          <button onClick={onClose} aria-label="Close feedback">×</button>
        </div>
        <nav className="feedback-tabs">
          <button className={mode === "new" ? "active" : ""} onClick={() => { setMode("new"); setSelected(null); }}>Send feedback</button>
          <button className={mode === "history" ? "active" : ""} onClick={() => { setMode("history"); setSelected(null); void load(); }}>
            My Feedback <span>{items.length}</span>{unreadCount > 0 && <i className="feedback-unread-dot" aria-label={`${unreadCount} unread feedback updates`} />}
          </button>
        </nav>
        {mode === "new" ? (
          <div className="feedback-form">
            <p>Use this for bugs, feature ideas, usability problems, and data corrections. Report community content using that content’s report control.</p>
            <label>Type<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Title<input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Briefly describe the problem or idea" /></label>
            <label>Details<textarea value={description} maxLength={4000} onChange={(event) => setDescription(event.target.value)} placeholder="What happened? What did you expect? Include steps if this is a bug." /></label>
            <label>Screenshot (optional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setScreenshot(event.target.files?.[0] || null)} /><small>Images are compressed and location metadata is removed before upload.</small></label>
            <label className="feedback-check"><input type="checkbox" checked={includeDiagnostics} onChange={(event) => setIncludeDiagnostics(event.target.checked)} /><span><b>Include basic diagnostics</b><small>Browser, operating system, screen size, language, online status, and current page. Tokens, passwords, and protected coordinates are never included.</small></span></label>
            <label className="feedback-check"><input type="checkbox" checked={contactAllowed} onChange={(event) => setContactAllowed(event.target.checked)} /><span><b>Allow staff responses and status notifications</b><small>Messages remain inside your FeatherMap account.</small></span></label>
            <button className="primary feedback-submit" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send feedback"}</button>
          </div>
        ) : selected ? (
          <div className="feedback-detail">
            <button className="feedback-back" onClick={() => setSelected(null)}>← All feedback</button>
            <span className={`feedback-status status-${selected.feedback.status}`}>{titleCase(selected.feedback.status)}</span>
            <h3>{selected.feedback.title}</h3><p>{selected.feedback.description}</p>
            {selected.attachments?.length > 0 && <PrivateFeedbackGallery attachments={selected.attachments} token={token} />}
            {selected.feedback.resolution_summary && <div className="feedback-resolution"><b>Resolution</b><p>{selected.feedback.resolution_summary}</p></div>}
            <div className="feedback-thread">{selected.messages?.map((message: any) => <article key={message.id}><b>{message.author_id === selected.feedback.submitted_by ? "You" : "FeatherMap staff"}</b><time>{new Date(message.created_at).toLocaleString()}</time><p>{message.body}</p></article>)}</div>
            <div className="feedback-reply"><textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={2000} placeholder="Reply or provide more information" /><button disabled={busy || !reply.trim()} onClick={sendReply}>Send</button></div>
          </div>
        ) : (
          <div className="feedback-list">
            {items.length ? items.map((item) => (
              <button className={item.unread ? "unread" : ""} key={item.id} onClick={() => openItem(item.id)}>
                <span>{item.unread && <i className="feedback-unread-dot" aria-hidden="true" />}<b>{item.title}</b><small>{categories.find((entry) => entry[0] === item.category)?.[1]} · {new Date(item.created_at).toLocaleDateString()}</small></span>
                <em className={`feedback-status status-${item.status}`}>{titleCase(item.status)}</em>
                {item.unread && <span className="sr-only">Unread staff update</span>}
              </button>
            )) : <p>No feedback submitted yet.</p>}
          </div>
        )}
        {status && <p className="feedback-message" role="status">{status}</p>}
      </section>
    </div>
  );
}
