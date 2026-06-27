"use client";

import { FormEvent, useState } from "react";

type Stop = {
  node_id: string;
  name: string;
  floor: string;
  category: string;
  duration_minutes: number;
  estimated_spend_sgd: number;
  reason: string;
};

type LiveContext = {
  status: "ready" | "empty" | "unavailable" | "skipped";
  message: string;
  items: Array<{
    title: string;
    summary: string;
    url: string;
    source: string;
  }>;
};

type ConciergeResponse =
  | {
      status: "ready";
      message: string;
      itinerary: {
        stops: Stop[];
        estimated_total_minutes: number;
        estimated_total_spend_sgd: number;
        fits_duration: boolean;
        fits_budget: boolean;
      };
      liveContext: LiveContext;
    }
  | { status: "error"; message: string };

export function ConciergePanel() {
  const [message, setMessage] = useState("");
  const [includeLiveContext, setIncludeLiveContext] = useState(true);
  const [response, setResponse] = useState<ConciergeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;

    setIsLoading(true);
    setResponse(null);

    try {
      const apiResponse = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, includeLiveContext })
      });
      setResponse((await apiResponse.json()) as ConciergeResponse);
    } catch {
      setResponse({ status: "error", message: "The concierge is unavailable right now." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="ai-panel" aria-labelledby="concierge-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">OpenAI + Exa concierge</p>
          <h2 id="concierge-title">Plan a Plaza Sing outing</h2>
        </div>
        <span>Plan</span>
      </div>

      <form className="ai-form" onSubmit={handleSubmit}>
        <label className="select-field" htmlFor="concierge-message">
          <span>Tell us your time, budget and vibe</span>
          <textarea
            id="concierge-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={900}
            placeholder="I’m going to Plaza Sing with my girlfriend. We have 3 hours and $100 for dinner, dessert and casual shopping."
          />
        </label>

        <label className="checkbox-field" htmlFor="include-live-context">
          <input
            id="include-live-context"
            type="checkbox"
            checked={includeLiveContext}
            onChange={(event) => setIncludeLiveContext(event.target.checked)}
          />
          <span>Include current official promotions and events with Exa</span>
        </label>

        <button className="primary-button" type="submit" disabled={isLoading}>
          {isLoading ? "Planning…" : "Build my plan"}
        </button>
      </form>

      {response?.status === "error" ? <p className="ai-response">{response.message}</p> : null}

      {response?.status === "ready" ? (
        <div className="concierge-result">
          <p className="ai-response">{response.message}</p>
          <div className="plan-summary">
            <span>~{response.itinerary.estimated_total_minutes} min</span>
            <span>~S${response.itinerary.estimated_total_spend_sgd}</span>
          </div>
          <ol className="plan-list">
            {response.itinerary.stops.map((stop, index) => (
              <li key={stop.node_id}>
                <span>{index + 1}</span>
                <div>
                  <strong>{stop.name}</strong>
                  <p>
                    {stop.floor} · ~{stop.duration_minutes} min · ~S${stop.estimated_spend_sgd}
                  </p>
                  <p>{stop.reason}</p>
                </div>
              </li>
            ))}
          </ol>

          <section className="live-context" aria-label="Exa live mall context">
            <p className="live-context-note">
              <strong>Exa live context</strong>
              <br />
              {response.liveContext.message}
            </p>

            {response.liveContext.items.length > 0 ? (
              <ul className="live-context-list">
                {response.liveContext.items.map((item) => (
                  <li key={item.url}>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <strong>{item.title}</strong>
                      <span>{item.source}</span>
                    </a>
                    <p>{item.summary}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
