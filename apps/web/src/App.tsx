import { useEffect, useState } from "react";
import { Workbench } from "./components/Workbench";
import { HistoryView } from "./components/HistoryView";
import { CalibrationView } from "./components/CalibrationView";
import { ProvidersView } from "./components/ProvidersView";
import { DocsView } from "./components/DocsView";
import { setDarkUI } from "./util";

type Tab = "workbench" | "history" | "calibration" | "providers" | "methods";

export default function App() {
  const [tab, setTab] = useState<Tab>("workbench");
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );

  useEffect(() => {
    setDarkUI(theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* private mode */ }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">审</div>
          <div className="brand-name">三堂会审 <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-faint)", marginLeft: 4 }}>Tribunal</span></div>
        </div>
        <nav className="tabs">
          {([["workbench", "检测"], ["history", "历史"],
            ["calibration", "校准"], ["providers", "模型接入"],
            ["methods", "原理"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} className={`tab${tab === id ? " on" : ""}`}
              onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <button className="ghost" style={{ padding: "6px 12px", fontSize: 12 }}
            title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
            onClick={toggleTheme}>
            {theme === "dark" ? "☀ 浅色" : "☾ 深色"}
          </button>
        </div>
      </header>

      <main className="main">
        {tab === "workbench" && <Workbench />}
        {tab === "history" && <HistoryView />}
        {tab === "calibration" && <CalibrationView />}
        {tab === "providers" && <ProvidersView />}
        {tab === "methods" && <DocsView />}
      </main>

      <footer style={{
        textAlign: "center", padding: "16px", fontSize: 11.5,
        color: "var(--text-faint)", borderTop: "1px solid var(--border-soft)",
      }}>
        三堂会审 Tribunal v1.0.0 ·{" "}
        <a href="https://github.com/kofwj/aitextjury-zh" target="_blank" rel="noreferrer"
          style={{ color: "var(--text-faint)", textDecoration: "underline" }}>
          GitHub
        </a>{" "}
        · MIT 开源 · 检测器是证据引擎，不是法官——改写过的文本可以骗过任何已知方法。
      </footer>
    </div>
  );
}
