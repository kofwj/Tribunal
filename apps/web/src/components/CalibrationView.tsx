import { useEffect, useState } from "react";
import { fetchBench, fetchCalibration, runCalibration } from "../api";
import type { BenchDataset, CalibrationFitPublic } from "../types";
import { fmtPct, detectorName } from "../util";

/**
 * 校准页 —— 诚实度引擎。
 * 每个检测器：拟合状态、数据集、AUC、准确率、ECE、Brier、阈值；
 * 可在任意标注集上重拟合（内置 demo 或自备 JSONL 放到 data/bench/）。
 */
export function CalibrationView() {
  const [fits, setFits] = useState<Record<string, CalibrationFitPublic>>({});
  const [datasets, setDatasets] = useState<BenchDataset[]>([]);
  const [dataset, setDataset] = useState("demo");
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<Record<string, CalibrationFitPublic> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [{ calibration }, { datasets }] =
        await Promise.all([fetchCalibration(), fetchBench()]);
      setFits(calibration);
      setDatasets(datasets);
      if (datasets.length && !datasets.some((d) => d.name === dataset)) {
        setDataset(datasets[0].name);
      }
    } catch (e) {
      setErr(String(e));
    }
  };

  useEffect(() => { void refresh(); }, []);

  const doRun = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await runCalibration(null, dataset);
      setLastRun(r.results);
      await refresh();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="panel">
        <h3>校准</h3>
        <p className="hint">
          检测器的原始统计量，在映射到概率之前没太大意义——映射靠的是标注语料。
          这里可以查看<b>诚实度指标</b>（AUC、准确率、ECE、Brier），
          也可以在任意标注集上重拟合。未校准的检测器会沿用默认阈值，
          并且一定会标出来。
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={dataset} onChange={(e) => setDataset(e.target.value)}>
            {datasets.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name} — {d.labels.ai} AI / {d.labels.human} 人工
              </option>
            ))}
          </select>
          <button className="primary" disabled={busy} onClick={doRun}>
            {busy ? (<><span className="spin" />校准中…</>)
                  : "重校准全部检测器"}
          </button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          注意：本地模型类检测器首次使用会下载约 500MB 模型，CPU 上跑几分钟。
          内置 demo 集只是<i>演示，不是基准</i>——正式用请放自己的标注数据
          <code>data/bench/*.jsonl</code> 再拟合。
        </p>
        {err && <div style={{ color: "var(--warn)" }}>{err}</div>}
        {lastRun && (
          <div style={{ marginTop: 10 }}>
            {Object.entries(lastRun).map(([id, r]) => (
              <div className="kv" key={id}>
                <span className="k">{detectorName(id, id)}</span>
                <span className="v" style={{
                  color: r.ok ? "var(--accent)" : "var(--warn)" }}>
                  {r.ok
                    ? `拟合完成 — AUC ${r.auc?.toFixed(2) ?? "—"}，准确率 ${fmtPct(r.accuracy)}`
                    : `失败：${r.reason ?? "?"}`}
                  {r.errors?.length ? `（${r.errors.length} 条样本出错）` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h3>当前拟合</h3>
        <table className="flat">
          <thead>
            <tr>
              <th>检测器</th><th>状态</th><th>数据集</th><th>样本数</th>
              <th>AUC</th><th>准确率</th><th>ECE</th><th>Brier</th>
              <th>阈值</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(fits).map(([id, f]) => (
              <tr key={id}>
                <td>{detectorName(id, id)}</td>
                <td><span className={`chip ${f.status === "calibrated" ? "accent" : "warn"}`}>
                  {f.status === "calibrated" ? "已校准" : f.status === "failed" ? "失败" : "未校准"}
                </span></td>
                <td className="num">{f.dataset || "—"}</td>
                <td className="num">{f.n}</td>
                <td className="num">{f.auc != null ? f.auc.toFixed(3) : "—"}</td>
                <td className="num">{fmtPct(f.accuracy)}</td>
                <td className="num">{f.ece != null ? f.ece.toFixed(3) : "—"}</td>
                <td className="num">{f.brier != null ? f.brier.toFixed(3) : "—"}</td>
                <td className="num">{f.threshold?.toFixed(2) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 10 }}>
          ECE = 期望校准误差（分箱的 |置信度 − 准确率|）；
          Brier = 概率均方误差。两者都是越小越好。
        </p>
      </div>
    </div>
  );
}
