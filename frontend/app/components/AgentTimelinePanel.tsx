"use client";

import { motion } from "framer-motion";

import type { TimelineEntry } from "../lib/workflow-intelligence";

interface AgentTimelinePanelProps {
  events: TimelineEntry[];
}

export function AgentTimelinePanel({ events }: AgentTimelinePanelProps) {
  return (
    <section className="panel stack timeline-panel">
      <div className="panel-headline-row">
        <div>
          <div className="eyebrow">Agent timeline</div>
          <h2 style={{ margin: 0 }}>Reasoning playback</h2>
        </div>
        <p className="muted panel-aside">
          Every major action is logged here so you can see what the agent noticed, how it responded, and why the current decision changed.
        </p>
      </div>
      {events.length === 0 ? (
        <p className="muted">Timeline events will appear as soon as the workflow starts.</p>
      ) : (
        <div className="timeline-feed">
          {events.map((event, index) => (
            <motion.article
              key={event.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, delay: index * 0.03 }}
              className={`timeline-item tone-${event.tone}`}
            >
              <div className="timeline-rail">
                <span className="timeline-dot" />
                <span className="timeline-line" />
              </div>
              <div className="timeline-card">
                <div className="timeline-meta-row">
                  <span className="timeline-stage">{event.stage}</span>
                  <span className="timeline-time">{event.timestamp}</span>
                </div>
                <strong className="timeline-headline">{event.headline}</strong>
                <p className="muted" style={{ margin: 0 }}>{event.detail}</p>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </section>
  );
}
