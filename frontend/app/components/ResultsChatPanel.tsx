"use client";

import { useState } from "react";

import type { ChatResponse } from "../lib/api";

interface Message {
  role: "user" | "assistant";
  text: string;
  citations?: ChatResponse["citations"];
}

interface ResultsChatPanelProps {
  ready: boolean;
  busy: boolean;
  messages: Message[];
  onAsk: (question: string) => Promise<void>;
}

export function ResultsChatPanel({ ready, busy, messages, onAsk }: ResultsChatPanelProps) {
  const [question, setQuestion] = useState("");

  async function handleSubmit() {
    const trimmed = question.trim();
    if (!trimmed || busy) {
      return;
    }
    setQuestion("");
    await onAsk(trimmed);
  }

  return (
    <section className="panel stack">
      <div className="eyebrow">Feature 5</div>
      <h2 style={{ margin: 0 }}>Natural-language Q&amp;A</h2>
      {!ready ? (
        <p className="muted">The chat unlocks after at least one analysis run completes.</p>
      ) : (
        <>
          <div className="chat-thread">
            {messages.length === 0 ? (
              <div className="chat-bubble assistant-bubble muted">Ask about thermal stress, hotspot gates, capability, or suitability claims.</div>
            ) : (
              messages.map((message, index) => (
                <div className={`chat-bubble ${message.role === "assistant" ? "assistant-bubble" : "user-bubble"}`} key={`${message.role}-${index}`}>
                  <p style={{ marginTop: 0 }}>{message.text}</p>
                  {message.citations?.length ? (
                    <div className="citation-strip">
                      {message.citations.map((citation, citationIndex) => (
                        <span className="citation-pill" key={`${citation.reference}-${citationIndex}`}>
                          {citation.kind}: {citation.reference}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <div className="chat-row">
            <input
              className="chat-input"
              placeholder="Which gate is most likely to fail first under thermal stress?"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleSubmit();
                }
              }}
            />
            <button className="action-btn" disabled={busy || !question.trim()} onClick={() => void handleSubmit()} type="button">
              {busy ? "Thinking..." : "Ask"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
