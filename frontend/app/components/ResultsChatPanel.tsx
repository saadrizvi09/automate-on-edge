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

const suggestedPrompts = [
  "Why did you reject this chip?",
  "What coverage gaps still remain?",
  "Which gate is most likely to fail first under thermal stress?",
];

export function ResultsChatPanel({ ready, busy, messages, onAsk }: ResultsChatPanelProps) {
  const [question, setQuestion] = useState("");

  async function handleSubmit(value = question) {
    const trimmed = value.trim();
    if (!trimmed || busy) {
      return;
    }
    setQuestion("");
    await onAsk(trimmed);
  }

  return (
    <section className="panel stack">
      <div className="panel-headline-row">
        <div>
          <div className="eyebrow">Results chat</div>
          <h2 style={{ margin: 0 }}>Natural-language Q&amp;A</h2>
        </div>
        <span className="signal-chip">citations grounded</span>
      </div>
      {!ready ? (
        <p className="muted">The chat unlocks after at least one analysis run completes.</p>
      ) : (
        <>
          <div className="signal-chip-row">
            {suggestedPrompts.map((prompt) => (
              <button className="ghost-chip" key={prompt} onClick={() => void handleSubmit(prompt)} type="button">
                {prompt}
              </button>
            ))}
          </div>
          <div className="chat-thread">
            {messages.length === 0 ? (
              <div className="chat-bubble assistant-bubble muted">Ask about rejection reasons, coverage gaps, hotspot gates, capability, or suitability claims.</div>
            ) : (
              messages.map((message, index) => (
                <div className={`chat-bubble ${message.role === "assistant" ? "assistant-bubble" : "user-bubble"}`} key={`${message.role}-${index}`}>
                  <p style={{ marginTop: 0 }}>{message.text}</p>
                  {message.citations?.length ? (
                    <div className="citation-stack">
                      {message.citations.map((citation, citationIndex) => (
                        <div className="citation-card" key={`${citation.reference}-${citationIndex}`}>
                          <span className="citation-pill">
                            {citation.kind}: {citation.reference}
                          </span>
                          <span className="muted">{citation.excerpt}</span>
                        </div>
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
              placeholder="Ask why the part was rejected, what was covered, or where the next risk sits."
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

