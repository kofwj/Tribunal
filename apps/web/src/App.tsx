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
  // index.html sets data-theme pre-mount (localStorage -> OS preference);
  // React adopts that and flips it when toggled.
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
        <div className="logo">
          <span className="name">AI<em>文本</em>陪审团</span>
          <span className="tag">
            多检测器会审 · 看证据不看单一分数 · 自带 Key
          </span>
        </div>
        <nav className="tabs">
          {([["workbench", "检测"], ["history", "历史"],
            ["calibration", "校准"], ["providers", "模型接入"],
            ["methods", "原理"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <button className="ghost theme-toggle"
          title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          onClick={toggleTheme}>
          {theme === "dark" ? "☀ 浅色" : "☾ 深色"}
        </button>
      </header>

      <div className="masthead">
        <b>多检测器共识</b> · 句子级热力图 · 困惑度与曲率信号 · 校准（AUC/ECE) · 插件 API —{" "}
        <span>无需账号，无遥测，密钥只留在本机</span>
      </div>

      <main className="page">
        {tab === "workbench" && <Workbench />}
        {tab === "history" && <HistoryView />}
        {tab === "calibration" && <CalibrationView />}
        {tab === "providers" && <ProvidersView />}
        {tab === "methods" && <DocsView />}
      </main>

      <footer className="pagefoot">
        AITextJury v0.1.0 · MIT 开源 · 检测器是证据引擎，不是法官——改写过的文本可以骗过任何已知方法。
      </footer>
    </div>
  );
}
