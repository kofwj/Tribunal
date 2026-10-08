import { useEffect, useState } from "react";
import { deleteProvider, fetchKeys, saveProvider, testProvider } from "../api";
import type { PublicProvider, ProviderTemplate } from "../types";

type Draft = {
  kind: string; base_url: string; api_key: string;
  default_model: string; note: string; template: string;
};

const BLANK: Draft = {
  kind: "openai_compatible", base_url: "",
  api_key: "", default_model: "", note: "", template: "",
};

/**
 * 自带 Key 管理。密钥只存在本机 data/providers.json，
 * 只发往你配置的接口。保存后 UI 不再显示完整密钥。
 */
export function ProvidersView() {
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [templates, setTemplates] = useState<Record<string, ProviderTemplate>>({});
  const [storage, setStorage] = useState("");
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tests, setTests] = useState<Record<string, { ok: boolean; detail: string; latency_ms: number }>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const refresh = async () => {
    const data = await fetchKeys();
    setProviders(data.providers);
    setTemplates(data.templates);
    setStorage(data.storage);
  };

  useEffect(() => { void refresh(); }, []);

  const pickTemplate = (name: string) => {
    const t = templates[name];
    if (!t) return;
    setDraft({
      ...draft,
      template: name,
      kind: t.kind,
      base_url: t.base_url,
      default_model: t.default_model,
    });
  };

  const save = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      // 密钥框空着 = 保留原来的；不填 id = 新建，服务端按模板生成 id
      const r = await saveProvider({
        id: editingId ?? undefined,
        kind: draft.kind, base_url: draft.base_url,
        api_key: draft.api_key || undefined,
        default_model: draft.default_model, note: draft.note,
        template: editingId ? undefined : (draft.template || undefined),
      });
      setDraft(BLANK);
      setEditingId(null);
      await refresh();
      const label = r.id ?? editingId ?? "provider";
      setFeedback(`已保存「${label}」——密钥只存在 ${storage}`);
    } catch (e) {
      setFeedback(String(e));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p: PublicProvider) => {
    setEditingId(p.id);
    setDraft({
      kind: p.kind, base_url: p.base_url, api_key: "",
      default_model: p.default_model, note: p.note, template: "",
    });
    setFeedback(`正在编辑「${p.id}」——密钥留空即保留原值`);
  };

  const doTest = async (id: string) => {
    setTests({ ...tests, [id]: { ok: false, detail: "…", latency_ms: 0 } });
    try {
      const r = await testProvider(id);
      setTests({ ...tests, [id]: r });
    } catch (e) {
      setTests({ ...tests, [id]: { ok: false, detail: String(e), latency_ms: 0 } });
    }
  };

  return (
    <div>
      <div className="panel">
        <h3>自带 Key</h3>
        <p className="hint">
          接入 OpenAI、Gemini、DeepSeek、OpenRouter、Groq、本地 Ollama
         （免 Key）或任何 OpenAI 兼容接口（vLLM、LM Studio…）。
          密钥存在本机 <code>{storage || "data/providers.json"}</code>，
          <b>只发往你配置的服务商</b>，永不完整回显。
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {Object.keys(templates).map((t) => (
            <button key={t} className="ghost" onClick={() => pickTemplate(t)}>
              + {t}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
          <select value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
            <option value="openai_compatible">openai 兼容</option>
            <option value="gemini">gemini</option>
          </select>
          <input placeholder="接口地址（从模板带入）" value={draft.base_url}
            onChange={(e) => setDraft({ ...draft, base_url: e.target.value })} />
          <input placeholder="模型（如 gpt-4o-mini / qwen2.5:7b)"
            value={draft.default_model}
            onChange={(e) => setDraft({ ...draft, default_model: e.target.value })} />
          <input placeholder="API 密钥（空 = 保留原值 / 读环境变量）"
            value={draft.api_key} type="password"
            onKeyDown={(e) => { if (e.key === "Enter" && draft.base_url.trim()) void save(); }}
            onChange={(e) => setDraft({ ...draft, api_key: e.target.value })} />
          <input placeholder="备注——你给它起的名字（可选）" value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="primary" disabled={busy || !draft.base_url.trim()}
            onClick={() => void save()}>
            {busy ? "保存中…" : editingId ? `保存「${editingId}」` : "添加服务商"}
          </button>
          {editingId && (
            <button className="ghost" style={{ marginLeft: 8, padding: "2px 9px", fontSize: 12 }}
              onClick={() => { setEditingId(null); setDraft(BLANK); setFeedback(null); }}>
              取消（改为新建）
            </button>
          )}
          {feedback && (
            <span style={{ marginLeft: 12, fontSize: 12.5, color: "var(--warn)" }}>
              {feedback}
            </span>
          )}
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          服务商 id 按你选的模板自动生成（<code>deepseek</code>、<code>deepseek:2</code>…），
          备注是你看到的名字。环境变量兜底：密钥留空时会读模板对应的环境变量
          （<code>OPENAI_API_KEY</code>、<code>GEMINI_API_KEY</code>、
          <code>DEEPSEEK_API_KEY</code>…）。
        </p>
      </div>

      <div className="panel">
        <h3>已配置的服务商</h3>
        <table className="flat">
          <thead>
            <tr><th>服务商</th><th>类型</th><th>接口地址</th><th>模型</th>
                <th>密钥</th><th>连通性</th><th></th></tr>
          </thead>
          <tbody>
            {providers.map((p) => {
              const t = tests[p.id];
              return (
                <tr key={p.id}>
                  <td><b>{p.note || p.id}</b>{p.note ? <span style={{ color: "var(--text-faint)" }}> · {p.id}</span> : null}</td>
                  <td className="num">{p.kind === "openai_compatible" ? "openai 兼容" : p.kind}</td>
                  <td className="num" style={{ fontSize: 12 }}>{p.base_url}</td>
                  <td className="num" style={{ fontSize: 12 }}>{p.default_model}</td>
                  <td>
                    <span className={`chip ${p.has_key ? "accent" : ""}`}>
                      {p.has_key ? p.key_mask : "无密钥"}
                    </span>
                    {p.env_key && <span className="chip">环境变量: {p.env_key}</span>}
                  </td>
                  <td className="num" style={{ fontSize: 12 }}>
                    {t ? (t.ok
                      ? <span style={{ color: "var(--accent)" }}>正常 ({t.latency_ms} ms)</span>
                      : <span style={{ color: "var(--warn)" }}>{t.detail}</span>)
                      : "—"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="ghost" style={{ padding: "2px 9px", fontSize: 12, marginRight: 6 }}
                      onClick={() => void doTest(p.id)}>测试</button>
                    <button className="ghost" style={{ padding: "2px 9px", fontSize: 12, marginRight: 6 }}
                      onClick={() => startEdit(p)}>编辑</button>
                    <button className="ghost" style={{ padding: "2px 9px", fontSize: 12 }}
                      onClick={async () => {
                        await deleteProvider(p.id);
                        void refresh();
                      }}>删除</button>
                  </td>
                </tr>
              );
            })}
            {providers.length === 0 && (
              <tr><td colSpan={7} style={{ color: "var(--text-faint)" }}>
                还没有——从上面的模板选一个。本地 Ollama
                <code> http://localhost:11434/v1</code> 免密钥即用。
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
