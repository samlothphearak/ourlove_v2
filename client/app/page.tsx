"use client";

import { useEffect, useState } from "react";
import {
  Heart,
  House,
  MessageCircle,
  Images,
  CalendarDays,
  UserRound,
  ArrowUpRight,
  Sparkles,
  Gift,
  Moon,
  MoreHorizontal,
} from "lucide-react";

import { getHealth } from "../lib/api";

type TabId = "home" | "chat" | "memories" | "days" | "us";

interface Tab {
  id: TabId;
  label: string;
  icon: typeof House;
}

interface Memory {
  id: number;
  title: string;
  date: string;
  image: string;
  type: string;
}

const tabs: Tab[] = [
  { id: "home", label: "Home", icon: House },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "memories", label: "Memories", icon: Images },
  { id: "days", label: "Our Days", icon: CalendarDays },
  { id: "us", label: "Us", icon: UserRound },
];

const memories: Memory[] = [
  {
    id: 1,
    title: "Our first adventure",
    date: "A beautiful day",
    image: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=700",
    type: "Together",
  },
  {
    id: 2,
    title: "Little moments",
    date: "A special memory",
    image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=700",
    type: "Love",
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [apiStatus, setApiStatus] = useState("Checking...");

  useEffect(() => {
    getHealth()
      .then((data) => {
        setApiStatus(
          data.database === "connected" ? "Connected" : "Database disconnected",
        );
      })
      .catch(() => setApiStatus("Offline"));
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Heart size={19} fill="currentColor" />
          </div>

          <div>
            <div className="brand-name">
              OurLove<span>.</span>
            </div>
            <div className="brand-caption">YOUR PRIVATE WORLD</div>
          </div>
        </div>

        <button className="icon-button" aria-label="More options">
          <MoreHorizontal size={22} />
        </button>
      </header>

      <div className="content">
        {activeTab === "home" ? (
          <>
            <section className="welcome-section">
              <div className="eyebrow">
                <Sparkles size={13} />A SPACE JUST FOR TWO
              </div>

              <h1>
                Welcome to
                <br />
                <span>Our Little World.</span>
              </h1>

              <p>Every little moment with you deserves to be remembered.</p>
            </section>

            <section className="love-card">
              <div className="card-glow" />

              <div className="love-card-top">
                <span className="live-label">
                  <span className="live-dot" />
                  YOUR LOVE STORY
                </span>
                <Heart size={20} color="#F6A4C5" />
              </div>

              <div className="couple-avatars">
                <div className="avatar avatar-one">Y</div>
                <div className="avatar avatar-heart">
                  <Heart size={16} fill="currentColor" />
                </div>
                <div className="avatar avatar-two">♥</div>
              </div>

              <div className="counter-label">EVERY DAY, A NEW MEMORY</div>

              <div className="counter-value">∞</div>

              <div className="counter-caption">
                Our story is still being written.
              </div>

              <div className="love-card-footer">
                <span>Always together</span>
                <Sparkles size={16} />
              </div>
            </section>

            <section className="section">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">YOUR SPACE</div>
                  <h2>Little things we share</h2>
                </div>
              </div>

              <div className="feature-grid">
                <Feature
                  icon={MessageCircle}
                  title="Our Chat"
                  description="Talk anytime"
                  color="pink"
                  onClick={() => setActiveTab("chat")}
                />

                <Feature
                  icon={Images}
                  title="Memories"
                  description="Save moments"
                  color="purple"
                  onClick={() => setActiveTab("memories")}
                />

                <Feature
                  icon={CalendarDays}
                  title="Our Days"
                  description="Special dates"
                  color="blue"
                  onClick={() => setActiveTab("days")}
                />

                <Feature
                  icon={Gift}
                  title="Love Notes"
                  description="Little surprises"
                  color="orange"
                  onClick={() => setActiveTab("us")}
                />
              </div>
            </section>

            <section className="section">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">CAPTURED FOREVER</div>
                  <h2>Recent memories</h2>
                </div>

                <button
                  className="text-button"
                  onClick={() => setActiveTab("memories")}
                >
                  See all <ArrowUpRight size={15} />
                </button>
              </div>

              <div className="memory-list">
                {memories.map((memory) => (
                  <article className="memory-card" key={memory.id}>
                    <img src={memory.image} alt={memory.title} />

                    <div className="memory-info">
                      <span>{memory.type}</span>
                      <h3>{memory.title}</h3>
                      <p>{memory.date}</p>
                    </div>

                    <Heart size={17} className="memory-heart" />
                  </article>
                ))}
              </div>
            </section>

            <section className="quote-card">
              <Moon size={18} />
              <p>"In a world full of people, I'd still choose you."</p>
              <span>A LITTLE REMINDER OF US ♡</span>
            </section>
          </>
        ) : (
          <section className="placeholder-page">
            <div className="placeholder-icon">
              <Heart size={34} />
            </div>

            <div className="section-kicker">COMING TOGETHER</div>
            <h2>{tabs.find((tab) => tab.id === activeTab)?.label}</h2>

            <p>
              This part of OurLove is being prepared. Your shared world is
              growing.
            </p>

            <button
              className="primary-button"
              onClick={() => setActiveTab("home")}
            >
              Back to home
            </button>
          </section>
        )}
      </div>

      <nav className="bottom-nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              className={`nav-item ${active ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={21} strokeWidth={active ? 2.5 : 1.8} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <footer className="app-footer">
        <span className="status-dot" />
        OurLove API: {apiStatus}
      </footer>
    </main>
  );
}

interface FeatureProps {
  icon: typeof House;
  title: string;
  description: string;
  color: string;
  onClick: () => void;
}

function Feature({
  icon: Icon,
  title,
  description,
  color,
  onClick,
}: FeatureProps) {
  return (
    <button className="feature-card" onClick={onClick}>
      <div className={`feature-icon ${color}`}>
        <Icon size={21} />
      </div>

      <div className="feature-title">{title}</div>
      <div className="feature-description">{description}</div>

      <ArrowUpRight className="feature-arrow" size={15} />
    </button>
  );
}
