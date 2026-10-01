"use client";

import {
  CheckCircle2,
  Mail,
  MessageSquareText,
  RefreshCw,
  Send,
  UsersRound,
} from "lucide-react";
import * as React from "react";

import { PendingMark } from "@/components/PendingMark";
import { useTranslation } from "@/lib/i18n";

type LeadStatus = "PENDING" | "INVITED" | "CONVERTED" | "REJECTED";
type MaritalStatus = "MARRIED" | "SINGLE" | "DIVORCED";
type FeedbackStatus = "SUBMITTED" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED";
type ResidentLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  building: string;
  floor: string;
  flatNumber: string;
  jobTitle?: string | null;
  maritalStatus?: MaritalStatus | null;
  status: LeadStatus;
  createdAt: string;
};
type Feedback = {
  id: string;
  category: string;
  body: string;
  isAnonymous: boolean;
  status: FeedbackStatus;
  createdAt: string;
};
type PagePayload<T> = { data?: { items?: T[] } };

const leadStatuses: LeadStatus[] = [
  "PENDING",
  "INVITED",
  "CONVERTED",
  "REJECTED",
];
const feedbackStatuses: FeedbackStatus[] = [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "RESOLVED",
];
const maritalLabelsEn: Record<MaritalStatus, string> = {
  MARRIED: "Married",
  SINGLE: "Single",
  DIVORCED: "Divorced",
};
const maritalLabelsAr: Record<MaritalStatus, string> = {
  MARRIED: "متزوج",
  SINGLE: "أعزب",
  DIVORCED: "منفصل",
};

function itemsFrom<T>(payload: PagePayload<T> | null): T[] {
  return payload?.data?.items ?? [];
}

export function ResidentRequestsPanel() {
  const { lang } = useTranslation();
  const [status, setStatus] = React.useState<LeadStatus | "ALL">("PENDING");
  const [items, setItems] = React.useState<ResidentLead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [actionError, setActionError] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const ar = lang === "ar";

  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const query = status === "ALL" ? "" : `?status=${status}`;
        const response = await fetch(`/api/admin/residents/leads${query}`, { cache: "no-store" });
        if (!response.ok) throw new Error("request");
        if (active) setItems(itemsFrom<ResidentLead>((await response.json()) as PagePayload<ResidentLead>));
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [status, reloadKey]);

  function selectStatus(value: string) {
    setLoading(true); setError(false); setStatus(value as LeadStatus | "ALL");
  }

  function retry() {
    setLoading(true); setError(false); setReloadKey((value) => value + 1);
  }

  async function invite(id: string) {
    setActionError(false);
    setPendingId(id);
    try {
      const response = await fetch(
        `/api/admin/residents/leads/${encodeURIComponent(id)}/invite`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error("request");
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status: "INVITED" } : item,
        ),
      );
    } catch {
      setActionError(true);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section
      aria-labelledby="resident-requests-title"
      className="border-t border-border pt-8"
    >
      <PanelHeading
        icon={UsersRound}
        id="resident-requests-title"
        title={ar ? "طلبات السكان" : "Resident requests"}
        body={
          ar
            ? "راجع طلبات الوحدات وأرسل دعوات التسجيل المعتمدة."
            : "Review unit applications and invite approved residents."
        }
      />
      <FilterBar
        value={status}
        values={["ALL", ...leadStatuses]}
        onChange={selectStatus}
        labels={ar ? leadLabelsAr : leadLabelsEn}
      />
      <PanelState
        loading={loading}
        error={error}
        empty={!items.length}
        onRetry={retry}
        ar={ar}
      />
      {actionError && (
        <p role="alert" className="mb-4 border-y border-error/30 bg-error/10 px-4 py-3 text-error">
          {ar ? "تعذر إرسال الدعوة. حاول مرة أخرى." : "Could not send the invitation. Try again."}
        </p>
      )}
      {!loading && !error && items.length > 0 && (
        <div className="divide-y divide-border border-y border-border">
          {items.map((item) => (
            <article
              key={item.id}
              className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[length:var(--text-body-lg)] font-bold">
                    {item.name}
                  </h3>
                  <StatusBadge
                    label={(ar ? leadLabelsAr : leadLabelsEn)[item.status]}
                    status={item.status}
                  />
                </div>
                <p
                  className="mt-2 break-all text-[length:var(--text-label)] text-muted-foreground"
                  dir="ltr"
                >
                  {item.email} · {item.phone}
                </p>
                <p className="mt-1 text-[length:var(--text-label)] text-muted-foreground">
                  {ar ? "عمارة" : "Building"} {item.building} ·{" "}
                  {ar ? "دور" : "Floor"} {item.floor} · {ar ? "شقة" : "Flat"}{" "}
                  {item.flatNumber}
                </p>
                {(item.jobTitle || item.maritalStatus) && (
                  <p className="mt-1 text-[length:var(--text-label)] text-muted-foreground">
                    {item.jobTitle && <span>{ar ? "الوظيفة" : "Job"}: {item.jobTitle}</span>}
                    {item.jobTitle && item.maritalStatus && " · "}
                    {item.maritalStatus && (ar ? maritalLabelsAr : maritalLabelsEn)[item.maritalStatus]}
                  </p>
                )}
              </div>
              {item.status === "PENDING" && (
                <button
                  type="button"
                  onClick={() => void invite(item.id)}
                  disabled={pendingId === item.id}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 text-[length:var(--text-button)] font-bold text-primary-foreground disabled:opacity-60"
                >
                  {pendingId === item.id ? (
                    <PendingMark />
                  ) : (
                    <Mail aria-hidden="true" className="size-4.5" />
                  )}
                  {ar ? "إرسال الدعوة" : "Send invitation"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function ComplaintsPanel() {
  const { lang } = useTranslation();
  const [status, setStatus] = React.useState<FeedbackStatus | "ALL">("ALL");
  const [items, setItems] = React.useState<Feedback[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [replies, setReplies] = React.useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = React.useState(0);
  const ar = lang === "ar";

  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const query = status === "ALL" ? "" : `?status=${status}`;
        const response = await fetch(`/api/admin/feedback${query}`, { cache: "no-store" });
        if (!response.ok) throw new Error("request");
        if (active) setItems(itemsFrom<Feedback>((await response.json()) as PagePayload<Feedback>));
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [status, reloadKey]);

  function selectStatus(value: string) {
    setLoading(true); setError(false); setStatus(value as FeedbackStatus | "ALL");
  }

  function retry() {
    setLoading(true); setError(false); setReloadKey((value) => value + 1);
  }

  async function updateStatus(id: string, nextStatus: FeedbackStatus) {
    setPendingId(id);
    try {
      const response = await fetch(
        `/api/admin/feedback/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      if (!response.ok) throw new Error("request");
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status: nextStatus } : item,
        ),
      );
    } catch {
      setError(true);
    } finally {
      setPendingId(null);
    }
  }

  async function reply(id: string) {
    const body = replies[id]?.trim();
    if (!body) return;
    setPendingId(id);
    try {
      const response = await fetch(
        `/api/admin/feedback/${encodeURIComponent(id)}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      if (!response.ok) throw new Error("request");
      setReplies((current) => ({ ...current, [id]: "" }));
    } catch {
      setError(true);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section
      aria-labelledby="complaints-title"
      className="border-t border-border pt-8"
    >
      <PanelHeading
        icon={MessageSquareText}
        id="complaints-title"
        title={ar ? "الشكاوى والمتابعة" : "Complaints and follow-up"}
        body={
          ar
            ? "تابع شكاوى السكان وحدّث حالتها وأرسل رد الإدارة."
            : "Triage resident complaints, update progress, and send an official reply."
        }
      />
      <FilterBar
        value={status}
        values={["ALL", ...feedbackStatuses]}
        onChange={selectStatus}
        labels={ar ? feedbackLabelsAr : feedbackLabelsEn}
      />
      <PanelState
        loading={loading}
        error={error}
        empty={!items.length}
        onRetry={retry}
        ar={ar}
      />
      {!loading && !error && items.length > 0 && (
        <div className="divide-y divide-border border-y border-border">
          {items.map((item) => (
            <article key={item.id} className="py-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  label={
                    (ar ? feedbackLabelsAr : feedbackLabelsEn)[item.status]
                  }
                  status={item.status}
                />
                <span className="text-[length:var(--text-caption)] font-bold text-muted-foreground">
                  {item.category}
                </span>
                {item.isAnonymous && (
                  <span className="text-[length:var(--text-caption)] text-muted-foreground">
                    {ar ? "مجهولة للسكان" : "Anonymous to residents"}
                  </span>
                )}
              </div>
              <p className="mt-3 max-w-3xl text-[length:var(--text-body)] leading-7">
                {item.body}
              </p>
              <div className="mt-5 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
                <label className="grid gap-2 text-[length:var(--text-label)] font-semibold">
                  {ar ? "الحالة" : "Status"}
                  <select
                    value={item.status}
                    disabled={pendingId === item.id}
                    onChange={(event) =>
                      void updateStatus(
                        item.id,
                        event.target.value as FeedbackStatus,
                      )
                    }
                    className="min-h-12 rounded-md border border-input bg-background px-3"
                  >
                    {feedbackStatuses.map((value) => (
                      <option key={value} value={value}>
                        {(ar ? feedbackLabelsAr : feedbackLabelsEn)[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-[length:var(--text-label)] font-semibold">
                  {ar ? "رد الإدارة" : "Admin reply"}
                  <textarea
                    value={replies[item.id] ?? ""}
                    onChange={(event) =>
                      setReplies((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    rows={2}
                    maxLength={5000}
                    className="min-h-12 resize-y rounded-md border border-input bg-background px-3 py-2 font-normal"
                    placeholder={
                      ar
                        ? "اكتب تحديثاً واضحاً للسكان..."
                        : "Write a clear update for the resident..."
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void reply(item.id)}
                  disabled={pendingId === item.id || !replies[item.id]?.trim()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50"
                >
                  {pendingId === item.id ? (
                    <PendingMark />
                  ) : (
                    <Send aria-hidden="true" className="size-4.5" />
                  )}
                  {ar ? "إرسال الرد" : "Send reply"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PanelHeading({
  icon: Icon,
  id,
  title,
  body,
}: {
  icon: typeof UsersRound;
  id: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mb-7 flex items-start gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div>
        <h2 id={id} className="text-[length:var(--text-h2)] font-bold">
          {title}
        </h2>
        <p className="mt-1 text-[length:var(--text-body)] text-muted-foreground">
          {body}
        </p>
      </div>
    </div>
  );
}

function FilterBar({
  value,
  values,
  onChange,
  labels,
}: {
  value: string;
  values: string[];
  onChange: (value: string) => void;
  labels: Record<string, string>;
}) {
  return (
    <div
      role="group"
      aria-label="Filter"
      className="mb-6 flex gap-2 overflow-x-auto pb-2"
    >
      {values.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={value === item}
          onClick={() => onChange(item)}
          className={`min-h-11 shrink-0 rounded-full border px-4 text-[length:var(--text-label)] font-bold ${value === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}
        >
          {labels[item]}
        </button>
      ))}
    </div>
  );
}

function PanelState({
  loading,
  error,
  empty,
  onRetry,
  ar,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  onRetry: () => void;
  ar: boolean;
}) {
  if (loading)
    return (
      <div
        role="status"
        aria-busy="true"
        className="flex min-h-32 items-center justify-center"
      >
        <PendingMark />
      </div>
    );
  if (error)
    return (
      <div
        role="alert"
        className="flex min-h-32 flex-col items-center justify-center gap-3 border-y border-border text-center"
      >
        <p>{ar ? "تعذر تحميل البيانات." : "Could not load this data."}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center gap-2 font-bold text-primary"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          {ar ? "إعادة المحاولة" : "Retry"}
        </button>
      </div>
    );
  if (empty)
    return (
      <div className="flex min-h-32 items-center justify-center border-y border-border text-muted-foreground">
        <CheckCircle2 aria-hidden="true" className="me-2 size-5" />
        {ar ? "لا توجد عناصر في هذا العرض." : "Nothing in this view."}
      </div>
    );
  return null;
}

function StatusBadge({ label, status }: { label: string; status: string }) {
  const complete = status === "RESOLVED" || status === "CONVERTED";
  return (
    <span
      className={`rounded-full px-3 py-1 text-[length:var(--text-caption)] font-bold ${complete ? "bg-success/15 text-success" : "bg-muted text-foreground"}`}
    >
      {label}
    </span>
  );
}

const leadLabelsEn: Record<string, string> = {
  ALL: "All",
  PENDING: "Pending",
  INVITED: "Invited",
  CONVERTED: "Registered",
  REJECTED: "Rejected",
};
const leadLabelsAr: Record<string, string> = {
  ALL: "الكل",
  PENDING: "معلقة",
  INVITED: "تمت دعوتها",
  CONVERTED: "مسجلة",
  REJECTED: "مرفوضة",
};
const feedbackLabelsEn: Record<string, string> = {
  ALL: "All",
  SUBMITTED: "Submitted",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};
const feedbackLabelsAr: Record<string, string> = {
  ALL: "الكل",
  SUBMITTED: "مقدمة",
  ACKNOWLEDGED: "تم الاستلام",
  IN_PROGRESS: "قيد التنفيذ",
  RESOLVED: "تم الحل",
};
