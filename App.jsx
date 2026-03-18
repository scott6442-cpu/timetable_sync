import { useState, useEffect, useRef, useCallback } from "react";

// ✅ 여기에 본인 Supabase 정보 입력
const SUPABASE_URL = "https://bgqzmfmdzyehzxsfptcz.supabase.co";
const SUPABASE_KEY = "sb_publishable_3MmMv60zpx2CZwyeWLKoTA_nlCU96DJ";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const SLOTS = Array.from({ length: 32 }, (_, i) => {
  const h = Math.floor(i / 2 + 8).toString().padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

const PRESET_COLORS = ["#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#10b981","#06b6d4","#3b82f6","#e879f9"];

const DEFAULT_CATEGORIES = [
  { id: "sleep", label: "수면 😴", color: "#6366f1" },
  { id: "meal", label: "식사 🍽️", color: "#f59e0b" },
  { id: "class", label: "학교 수업 📚", color: "#10b981" },
  { id: "gym", label: "헬스장 💪", color: "#ef4444" },
  { id: "tennis", label: "테니스 🎾", color: "#3b82f6" },
  { id: "free", label: "자유 시간 ✨", color: "#8b5cf6" },
  { id: "work", label: "업무/공부 💻", color: "#06b6d4" },
];

const EMPTY_GRID = () => {
  const g = {};
  DAY_KEYS.forEach(d => { g[d] = {}; SLOTS.forEach(s => { g[d][s] = { cat: null, done: false }; }); });
  return g;
};

const getWeekKey = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return `${mon.getFullYear()}-W${String(Math.ceil((((mon - new Date(mon.getFullYear(), 0, 1)) / 86400000) + new Date(mon.getFullYear(), 0, 1).getDay() + 1) / 7)).padStart(2, "0")}`;
};

const getWeekLabel = (key) => {
  const [y, w] = key.split("-W");
  const jan1 = new Date(Number(y), 0, 1);
  const days = (Number(w) - 1) * 7;
  const mon = new Date(jan1.getTime() + (days - (jan1.getDay() || 7) + 1) * 86400000);
  const sun = new Date(mon.getTime() + 6 * 86400000);
  const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${y}년 ${fmt(mon)} ~ ${fmt(sun)}`;
};

const EMOJI_MAP = [
  { keys: ["수면","잠","취침","낮잠"], emojis: ["😴","🛌","💤","🌙","⭐"] },
  { keys: ["식사","밥","점심","저녁","아침","음식"], emojis: ["🍽️","🍱","🥗","🍜","🥘"] },
  { keys: ["수업","학교","강의","공부","학습"], emojis: ["📚","🏫","✏️","📖","🎓"] },
  { keys: ["헬스","운동","gym","피트니스"], emojis: ["💪","🏋️","🤸","🏃","⚡"] },
  { keys: ["테니스","라켓"], emojis: ["🎾","🏸","🎯","🏆","⚡"] },
  { keys: ["이동","출퇴근","통학","지하철","버스","교통"], emojis: ["🚇","🚌","🚗","🛵","🚶"] },
  { keys: ["독서","책","읽"], emojis: ["📖","📚","🔖","📝","☕"] },
  { keys: ["회의","미팅"], emojis: ["💼","🤝","📊","🗣️","📋"] },
  { keys: ["산책","걷기","등산"], emojis: ["🚶","🌿","🏞️","👟","🌄"] },
  { keys: ["쇼핑","마트"], emojis: ["🛒","🛍️","💳","🏪","📦"] },
  { keys: ["청소","집안일"], emojis: ["🧹","🧽","🪣","✨","🏠"] },
  { keys: ["요리"], emojis: ["👨‍🍳","🍳","🥄","🔪","🫕"] },
  { keys: ["게임"], emojis: ["🎮","🕹️","👾","🎲","⚔️"] },
  { keys: ["영화","드라마","유튜브"], emojis: ["🎬","🍿","📺","🎥","🎞️"] },
  { keys: ["음악","노래","악기"], emojis: ["🎵","🎸","🎹","🎤","🎧"] },
  { keys: ["친구","약속","만남"], emojis: ["👫","🤝","🥳","💬","🎉"] },
  { keys: ["병원","건강"], emojis: ["🏥","💊","🩺","❤️‍🩹","🩹"] },
  { keys: ["자유","휴식","쉬"], emojis: ["✨","😌","☕","🌈","🌸"] },
  { keys: ["업무","일","직장","회사"], emojis: ["💻","📊","🖥️","📁","⌨️"] },
  { keys: ["수영"], emojis: ["🏊","🌊","💦","🩱","🥽"] },
  { keys: ["자전거"], emojis: ["🚴","🚵","🏅","💨","🛞"] },
  { keys: ["명상","요가","스트레칭"], emojis: ["🧘","🌿","☮️","💆","🌅"] },
  { keys: ["과제","숙제","레포트"], emojis: ["📝","📋","✏️","📐","🖊️"] },
];

function getEmojiSuggestions(label) {
  if (!label.trim()) return [];
  const lower = label.toLowerCase();
  for (const entry of EMOJI_MAP) {
    if (entry.keys.some(k => lower.includes(k))) return entry.emojis;
  }
  return ["📌","⭐","🔵","🟢","🟡"];
}

// Supabase 저장/불러오기
async function loadFromSupabase() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/timetable?id=eq.main&select=data`, {
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
  });
  const rows = await res.json();
  return rows?.[0]?.data || null;
}

async function saveToSupabase(data) {
  await fetch(`${SUPABASE_URL}/rest/v1/timetable?id=eq.main`, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify({ data, updated_at: new Date().toISOString() })
  });
}

export default function App() {
  const [weeks, setWeeks] = useState({});
  const [currentWeek, setCurrentWeek] = useState(getWeekKey(new Date()));
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [selectedCat, setSelectedCat] = useState("sleep");
  const [mode, setMode] = useState("edit");
  const [dragging, setDragging] = useState(false);
  const [dragCat, setDragCat] = useState(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatColor, setNewCatColor] = useState("#e879f9");
  const [emojiSuggestions, setEmojiSuggestions] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [aiPanel, setAiPanel] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showWeekList, setShowWeekList] = useState(false);
  const [popupInfo, setPopupInfo] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | saving | saved | error
  const popupRef = useRef(null);
  const dragMode = useRef(null);
  const saveTimer = useRef(null);

  // 초기 로드
  useEffect(() => {
    (async () => {
      try {
        setSyncStatus("saving");
        const data = await loadFromSupabase();
        if (data) {
          if (data.weeks) setWeeks(data.weeks);
          if (data.categories) setCategories(data.categories);
        }
        setSyncStatus("saved");
      } catch { setSyncStatus("error"); }
    })();
  }, []);

  // 디바운스 저장 (입력 후 1초 뒤 저장)
  const save = useCallback((nw, nc) => {
    clearTimeout(saveTimer.current);
    setSyncStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        await saveToSupabase({ weeks: nw, categories: nc });
        setSyncStatus("saved");
      } catch { setSyncStatus("error"); }
    }, 1000);
  }, []);

  const grid = weeks[currentWeek] || EMPTY_GRID();

  const midSlots = {};
  DAY_KEYS.forEach(day => {
    midSlots[day] = new Set();
    let i = 0;
    while (i < SLOTS.length) {
      const cat = grid[day]?.[SLOTS[i]]?.cat;
      if (cat) {
        let j = i;
        while (j < SLOTS.length && grid[day]?.[SLOTS[j]]?.cat === cat) j++;
        midSlots[day].add(SLOTS[Math.floor((i + j - 1) / 2)]);
        i = j;
      } else i++;
    }
  });

  const updateCell = (day, slot, cat) => {
    const g = JSON.parse(JSON.stringify(grid));
    if (!g[day]) { g[day] = {}; SLOTS.forEach(s => { g[day][s] = { cat: null, done: false }; }); }
    if (!g[day][slot]) g[day][slot] = { cat: null, done: false };
    g[day][slot].cat = cat;
    const nw = { ...weeks, [currentWeek]: g };
    setWeeks(nw); save(nw, categories);
  };

  const toggleDone = (day, slot) => {
    const g = JSON.parse(JSON.stringify(grid));
    if (!g[day]?.[slot]) return;
    g[day][slot].done = !g[day][slot].done;
    const nw = { ...weeks, [currentWeek]: g };
    setWeeks(nw); save(nw, categories);
  };

  const handleCellMouseDown = (day, slot) => {
    if (popupInfo) { setPopupInfo(null); return; }
    if (mode === "check") { toggleDone(day, slot); return; }
    const cur = grid[day]?.[slot]?.cat;
    dragMode.current = cur === selectedCat ? "erase" : "paint";
    setDragging(true); setDragCat(selectedCat);
    updateCell(day, slot, dragMode.current === "paint" ? selectedCat : null);
  };

  const handleCellMouseEnter = (day, slot) => {
    if (!dragging || mode === "check") return;
    updateCell(day, slot, dragMode.current === "paint" ? dragCat : null);
  };

  const handleCellClick = (day, slot, e) => {
    if (mode !== "edit" || dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setPopupInfo({ day, slot, x: rect.left, y: rect.bottom });
  };

  useEffect(() => {
    const up = () => { setDragging(false); dragMode.current = null; };
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => { window.removeEventListener("mouseup", up); window.removeEventListener("touchend", up); };
  }, []);

  useEffect(() => {
    if (!popupInfo) return;
    const handler = (e) => { if (popupRef.current && !popupRef.current.contains(e.target)) setPopupInfo(null); };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [popupInfo]);

  const openAddModal = () => {
    setEditCat(null); setNewCatLabel(""); setNewCatColor("#e879f9");
    setEmojiSuggestions([]); setShowDeleteConfirm(false); setShowCatModal(true);
  };

  const openEditModal = (c) => {
    setEditCat(c); setNewCatLabel(c.label); setNewCatColor(c.color);
    setEmojiSuggestions(getEmojiSuggestions(c.label)); setShowDeleteConfirm(false); setShowCatModal(true);
  };

  const handleLabelChange = (val) => {
    setNewCatLabel(val);
    setEmojiSuggestions(getEmojiSuggestions(val));
  };

  const appendEmoji = (em) => {
    const base = newCatLabel.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
    setNewCatLabel(`${base} ${em}`.trim());
  };

  const saveCategory = () => {
    if (!newCatLabel.trim()) return;
    let updated;
    if (editCat) {
      updated = categories.map(c => c.id === editCat.id ? { ...c, label: newCatLabel, color: newCatColor } : c);
    } else {
      updated = [...categories, { id: `cat_${Date.now()}`, label: newCatLabel, color: newCatColor }];
    }
    setCategories(updated); save(weeks, updated); setShowCatModal(false);
  };

  const deleteCategory = () => {
    const updated = categories.filter(c => c.id !== editCat.id);
    const nw = JSON.parse(JSON.stringify(weeks));
    Object.keys(nw).forEach(wk => DAY_KEYS.forEach(d => SLOTS.forEach(s => {
      if (nw[wk][d]?.[s]?.cat === editCat.id) nw[wk][d][s].cat = null;
    })));
    setCategories(updated); setWeeks(nw); save(nw, updated);
    if (selectedCat === editCat.id) setSelectedCat(updated[0]?.id || null);
    setShowCatModal(false); setShowDeleteConfirm(false);
  };

  const createNewWeek = () => {
    if (!weeks[currentWeek]) { const nw = { ...weeks, [currentWeek]: EMPTY_GRID() }; setWeeks(nw); save(nw, categories); }
    setShowWeekList(false);
  };

  const getNextWeekKey = (key) => {
    const [y, w] = key.split("-W");
    const jan1 = new Date(Number(y), 0, 1);
    const days = (Number(w) - 1) * 7;
    const mon = new Date(jan1.getTime() + (days - (jan1.getDay() || 7) + 1) * 86400000);
    return getWeekKey(new Date(mon.getTime() + 7 * 86400000));
  };

  const copyToNewWeek = (fromKey) => {
    const next = getNextWeekKey(currentWeek);
    const nw = { ...weeks, [next]: JSON.parse(JSON.stringify(weeks[fromKey] || EMPTY_GRID())) };
    DAY_KEYS.forEach(d => SLOTS.forEach(s => { if (nw[next][d]?.[s]) nw[next][d][s].done = false; }));
    setWeeks(nw); setCurrentWeek(next); save(nw, categories); setShowWeekList(false);
  };

  const askAI = async () => {
    if (aiLoading) return;
    setAiLoading(true); setAiMsg("");
    const summary = {}, doneCount = {};
    categories.forEach(c => { summary[c.label] = 0; doneCount[c.label] = 0; });
    DAY_KEYS.forEach(d => SLOTS.forEach(s => {
      const cell = grid[d]?.[s];
      if (cell?.cat) { const c = categories.find(x => x.id === cell.cat); if (c) { summary[c.label] += 0.5; if (cell.done) doneCount[c.label] += 0.5; } }
    }));
    const prompt = `당신은 시간 관리 코치입니다.\n\n계획된 시간:\n${Object.entries(summary).map(([k,v]) => `- ${k}: ${v}시간`).join("\n")}\n\n실제 수행:\n${Object.entries(doneCount).map(([k,v]) => `- ${k}: ${v}시간`).join("\n")}\n\n1. 시간 배분 평가\n2. 계획 대비 실행률\n3. 개선 제안 1~2가지\n를 친근하고 간결하게 한국어로 알려주세요. 이모지 사용해주세요.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      setAiMsg(data.content?.[0]?.text || "분석 결과를 가져올 수 없습니다.");
    } catch { setAiMsg("AI 분석 중 오류가 발생했습니다."); }
    setAiLoading(false);
  };

  const weekKeys = Object.keys(weeks).sort().reverse();
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
  const totalPlanned = DAY_KEYS.reduce((acc, d) => acc + SLOTS.filter(s => grid[d]?.[s]?.cat).length, 0) * 0.5;
  const totalDone = DAY_KEYS.reduce((acc, d) => acc + SLOTS.filter(s => grid[d]?.[s]?.cat && grid[d]?.[s]?.done).length, 0) * 0.5;
  const doneRate = totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0;

  const syncLabel = syncStatus === "saving" ? "⏳ 저장 중..." : syncStatus === "saved" ? "☁️ 동기화됨" : syncStatus === "error" ? "❌ 저장 실패" : "";
  const syncColor = syncStatus === "saved" ? "#10b981" : syncStatus === "error" ? "#ef4444" : "#94a3b8";

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", userSelect: "none" }}>
      {/* Header */}
      <div style={{ background: "#1e293b", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderBottom: "1px solid #334155" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc" }}>📅 주간 시간표</span>
        <span style={{ fontSize: 11, color: syncColor }}>{syncLabel}</span>
        <button onClick={() => setShowWeekList(!showWeekList)} style={{ background: "#334155", border: "none", color: "#94a3b8", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
          {getWeekLabel(currentWeek)} ▾
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => setMode(mode === "edit" ? "check" : "edit")} style={{ background: mode === "check" ? "#10b981" : "#334155", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
            {mode === "edit" ? "✏️ 편집 모드" : "✅ 체크 모드"}
          </button>
          <button onClick={() => { setAiPanel(!aiPanel); if (!aiPanel) askAI(); }} style={{ background: "#6366f1", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
            🤖 AI 분석
          </button>
        </div>
      </div>

      {showWeekList && (
        <div style={{ position: "absolute", zIndex: 100, background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: 12, margin: "4px 16px", minWidth: 260, boxShadow: "0 8px 32px #0008" }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: "#94a3b8", fontSize: 12 }}>주차 선택</div>
          <button onClick={createNewWeek} style={{ width: "100%", background: "#6366f1", border: "none", color: "#fff", padding: "8px", borderRadius: 8, cursor: "pointer", marginBottom: 8, fontSize: 13 }}>+ 이번 주 새로 시작</button>
          {weekKeys.length > 0 && <button onClick={() => copyToNewWeek(weekKeys[0])} style={{ width: "100%", background: "#334155", border: "none", color: "#e2e8f0", padding: "8px", borderRadius: 8, cursor: "pointer", marginBottom: 8, fontSize: 13 }}>📋 지난 주 복사해서 다음 주 생성</button>}
          {weekKeys.map(k => (
            <div key={k} onClick={() => { setCurrentWeek(k); setShowWeekList(false); }} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: k === currentWeek ? "#334155" : "transparent", fontSize: 13 }}>
              {getWeekLabel(k)} {k === currentWeek && "◀"}
            </div>
          ))}
        </div>
      )}

      <div style={{ background: "#1e293b", padding: "8px 16px", display: "flex", gap: 20, fontSize: 13, color: "#94a3b8", borderBottom: "1px solid #334155" }}>
        <span>📌 계획: <b style={{ color: "#e2e8f0" }}>{totalPlanned}h</b></span>
        <span>✅ 완료: <b style={{ color: "#10b981" }}>{totalDone}h</b></span>
        <span>📊 달성률: <b style={{ color: doneRate >= 70 ? "#10b981" : doneRate >= 40 ? "#f59e0b" : "#ef4444" }}>{doneRate}%</b></span>
        <div style={{ marginLeft: "auto" }}>
          <div style={{ background: "#334155", borderRadius: 99, height: 8, width: 120, overflow: "hidden" }}>
            <div style={{ background: doneRate >= 70 ? "#10b981" : doneRate >= 40 ? "#f59e0b" : "#ef4444", width: `${doneRate}%`, height: "100%", transition: "width 0.3s" }} />
          </div>
        </div>
      </div>

      {aiPanel && (
        <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: "#a5b4fc" }}>🤖 AI 시간표 분석</span>
            <button onClick={() => setAiPanel(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}>×</button>
          </div>
          {aiLoading ? <div style={{ color: "#94a3b8", fontSize: 13 }}>분석 중... ⏳</div> : <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{aiMsg}</div>}
          <button onClick={askAI} style={{ marginTop: 10, background: "#6366f1", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>🔄 다시 분석</button>
        </div>
      )}

      <div style={{ background: "#1e293b", padding: "8px 16px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid #334155" }}>
        {categories.map(c => (
          <div key={c.id} style={{ display: "flex", alignItems: "center" }}>
            <div onClick={() => { setSelectedCat(c.id); setMode("edit"); }}
              style={{ padding: "4px 10px", borderRadius: "99px 0 0 99px", cursor: "pointer", fontSize: 12, background: selectedCat === c.id ? c.color : "#334155", color: selectedCat === c.id ? "#fff" : "#94a3b8", border: `2px solid ${selectedCat === c.id ? c.color : "transparent"}`, borderRight: "none", transition: "all 0.15s" }}>
              {c.label}
            </div>
            <div onClick={() => openEditModal(c)}
              style={{ padding: "4px 6px", borderRadius: "0 99px 99px 0", cursor: "pointer", fontSize: 10, background: selectedCat === c.id ? c.color : "#2d3f55", color: selectedCat === c.id ? "#fff" : "#64748b", border: `2px solid ${selectedCat === c.id ? c.color : "transparent"}`, borderLeft: "1px solid #0003", transition: "all 0.15s" }}>
              ✏️
            </div>
          </div>
        ))}
        <button onClick={openAddModal} style={{ background: "#334155", border: "1px dashed #475569", color: "#94a3b8", padding: "4px 10px", borderRadius: 99, cursor: "pointer", fontSize: 12 }}>+ 추가</button>
        <div onClick={() => { setSelectedCat(null); setMode("edit"); }}
          style={{ padding: "4px 10px", borderRadius: 99, cursor: "pointer", fontSize: 12, background: selectedCat === null ? "#ef4444" : "#334155", color: selectedCat === null ? "#fff" : "#94a3b8", border: `2px solid ${selectedCat === null ? "#ef4444" : "transparent"}` }}>
          🗑️ 지우기
        </div>
      </div>

      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: `52px repeat(7, minmax(60px, 1fr))`, minWidth: 520 }}>
          <div style={{ background: "#0f172a", position: "sticky", top: 0, zIndex: 10 }} />
          {DAYS.map((d, i) => (
            <div key={d} style={{ background: "#0f172a", padding: "6px 2px", textAlign: "center", fontWeight: 700, fontSize: 13, color: i >= 5 ? "#f59e0b" : "#e2e8f0", position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid #334155" }}>{d}</div>
          ))}
          {SLOTS.map((slot, si) => (
            <>
              <div key={`t-${slot}`} style={{ background: "#0f172a", fontSize: 10, color: "#475569", textAlign: "right", paddingRight: 6, paddingTop: 1, height: 18, lineHeight: "18px", position: "sticky", left: 0, zIndex: 5, borderRight: "1px solid #334155" }}>
                {si % 2 === 0 ? slot : ""}
              </div>
              {DAY_KEYS.map(day => {
                const cell = grid[day]?.[slot] || { cat: null, done: false };
                const c = cell.cat ? catMap[cell.cat] : null;
                const isDone = cell.done;
                const isMid = midSlots[day]?.has(slot);
                return (
                  <div key={`${day}-${slot}`}
                    onMouseDown={() => handleCellMouseDown(day, slot)}
                    onMouseEnter={() => handleCellMouseEnter(day, slot)}
                    onClick={e => handleCellClick(day, slot, e)}
                    style={{ height: 18, background: c ? c.color : "#1e293b", cursor: "pointer", borderBottom: si % 2 === 1 ? "1px solid #334155" : "none", borderRight: "1px solid #334155", position: "relative", opacity: isDone ? 0.5 : 1, boxSizing: "border-box" }}>
                    {isMid && c && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", pointerEvents: "none", textShadow: "0 1px 2px #0006" }}>
                        {isDone ? "✓ " : ""}{c.label}
                      </div>
                    )}
                    {!isMid && isDone && c && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff" }}>✓</div>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>

      {popupInfo && (
        <div ref={popupRef} style={{ position: "fixed", left: Math.min(popupInfo.x, window.innerWidth - 200), top: Math.min(popupInfo.y + 4, window.innerHeight - 300), zIndex: 200, background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: 10, boxShadow: "0 8px 32px #0009", minWidth: 180 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{DAYS[DAY_KEYS.indexOf(popupInfo.day)]}요일 {popupInfo.slot}</div>
          {categories.map(c => (
            <div key={c.id} onClick={() => { updateCell(popupInfo.day, popupInfo.slot, c.id); setPopupInfo(null); }}
              style={{ padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: c.color }} />{c.label}
            </div>
          ))}
          <div onClick={() => { updateCell(popupInfo.day, popupInfo.slot, null); setPopupInfo(null); }}
            style={{ padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#ef4444", display: "flex", alignItems: "center", gap: 8, marginTop: 4, borderTop: "1px solid #334155" }}>
            🗑️ 지우기
          </div>
        </div>
      )}

      {showCatModal && (
        <div style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <div style={{ background: "#1e293b", borderRadius: 14, padding: 24, minWidth: 300, boxShadow: "0 8px 32px #000c" }}>
            <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 16 }}>{editCat ? "카테고리 편집" : "새 카테고리 추가"}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>이름</div>
            <input value={newCatLabel} onChange={e => handleLabelChange(e.target.value)} placeholder="예: 이동시간"
              style={{ width: "100%", background: "#334155", border: "1px solid #475569", color: "#e2e8f0", padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 14, boxSizing: "border-box" }} />
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>이모지 추천</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, minHeight: 36, alignItems: "center" }}>
              {emojiSuggestions.length > 0 ? emojiSuggestions.map((em, i) => (
                <div key={i} onClick={() => appendEmoji(em)} style={{ fontSize: 22, cursor: "pointer", padding: "2px 6px", borderRadius: 8, background: "#334155" }}>{em}</div>
              )) : <span style={{ fontSize: 12, color: "#475569" }}>이름을 입력하면 추천이 나와요</span>}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>색상</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {PRESET_COLORS.map(col => (
                <div key={col} onClick={() => setNewCatColor(col)}
                  style={{ width: 28, height: 28, borderRadius: 99, background: col, cursor: "pointer", border: newCatColor === col ? "3px solid #fff" : "3px solid transparent", boxSizing: "border-box" }} />
              ))}
              <label style={{ width: 28, height: 28, borderRadius: 99, background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)", cursor: "pointer", border: "2px solid #475569", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} style={{ opacity: 0, width: 1, height: 1 }} />
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, background: newCatColor }} />
              <span style={{ fontSize: 13, color: "#94a3b8" }}>{newCatColor}</span>
            </div>
            {showDeleteConfirm && (
              <div style={{ background: "#2d1a1a", border: "1px solid #ef4444", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#fca5a5", marginBottom: 10 }}>정말 삭제할까요? 시간표에서도 모두 제거됩니다.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={deleteCategory} style={{ flex: 1, background: "#ef4444", border: "none", color: "#fff", padding: "8px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>삭제</button>
                  <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, background: "#334155", border: "none", color: "#e2e8f0", padding: "8px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>취소</button>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveCategory} style={{ flex: 1, background: "#6366f1", border: "none", color: "#fff", padding: "10px", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>{editCat ? "저장" : "추가"}</button>
              {editCat && !showDeleteConfirm && (
                <button onClick={() => setShowDeleteConfirm(true)} style={{ background: "#334155", border: "1px solid #ef4444", color: "#ef4444", padding: "10px 14px", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>🗑️</button>
              )}
              <button onClick={() => { setShowCatModal(false); setShowDeleteConfirm(false); }} style={{ flex: 1, background: "#334155", border: "none", color: "#e2e8f0", padding: "10px", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}