"use client";

import { FormEvent, useState } from "react";
import { RouteResult, RouteStep } from "@/lib/navigation";

type ReadyResponse = {
  status: "ready";
  message: string;
  start: { id: string };
  destination: { id: string };
  route: RouteResult;
  steps: RouteStep[];
};

type ChatResponse =
  | ReadyResponse
  | { status: "needs_clarification" | "error"; message: string };

type RouteChatProps = {
  onRouteReady: (response: ReadyResponse) => void;
};

export function RouteChat({ onRouteReady }: RouteChatProps) {
  const [message, setMessage] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    setIsLoading(true);
    setResponseMessage("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedMessage })
      });
      const payload = (await response.json()) as ChatResponse;

      if (!response.ok || payload.status !== "ready") {
        setResponseMessage(payload.message ?? "I could not understand that route request.");
        return;
      }

      setResponseMessage(payload.message);
      onRouteReady(payload);
    } catch {
      setResponseMessage("The AI route assistant is unavailable right now. Try the dropdown planner.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="ai-panel" aria-labelledby="ask-pathfinder-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">OpenAI route assistant</p>
          <h2 id="ask-pathfinder-title">Ask PathFinder</h2>
        </div>
        <span>AI</span>
      </div>

      <form className="ai-form" onSubmit={handleSubmit}>
        <label className="select-field" htmlFor="route-chat-message">
          <span>Ask in your own words</span>
          <textarea
            id="route-chat-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={700}
            placeholder="I’m at UNIQLO. How do I get to DBS?"
          />
        </label>
        <button className="primary-button" type="submit" disabled={isLoading}>
          {isLoading ? "Planning…" : "Ask PathFinder"}
        </button>
      </form>

      {responseMessage ? <p className="ai-response">{responseMessage}</p> : null}
    </section>
  );
}
