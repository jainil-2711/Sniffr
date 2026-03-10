import { useState, useEffect, useRef, useCallback } from "react";

const API = "http://localhost:8000/api";

async function api(path, opts = {}, token = null) {
  const headers = { ...(opts.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res  = await fetch(API + path, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* ─── STYLES ─────────────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
  :root {
    --bg:     #FFFFFF; --bg1: #F4F4F6; --bg2: #EAEAED; --bg3: #DCDCE0;
    --border: #D8D8DC; --b2: #B8B8C0;
    --text:   #0D0D0F; --t2: #2E2E38; --t3: #5C5C6E; --t4: #9898A8;
    --red:    #C62B00; --green: #197A39; --blue: #1558A0;
    --mono: 'Space Mono', monospace;
    --sans: 'Plus Jakarta Sans', sans-serif;
    --display: 'Space Grotesk', sans-serif;
    --radius: 6px;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg1); color: var(--text); font-family: var(--sans); font-size: 14px; line-height: 1.5; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: var(--border); }
  @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .fade { animation: fadeUp 0.3s ease; }
  .spin { animation: spin 1s linear infinite; }

  /* ── App shell ── */
  .app { min-height: 100vh; background: var(--bg1); }

  /* ── Header ── */
  .hdr {
    background: var(--bg); border-bottom: 1px solid var(--border);
    height: 62px; padding: 0 32px;
    display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 200;
  }
  .logo { display: flex; align-items: center; gap: 12px; }
  .logo-img { height: 36px; width: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .logo-sep { color: var(--t3); font-weight: 400; font-size: 14px; font-family: var(--display); letter-spacing: 0.01em; }
  .hdr-right { display: flex; align-items: center; gap: 12px; }
  .pill {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 12px; border: 1px solid var(--border); border-radius: 20px;
    font-family: var(--display); font-size: 12px; font-weight: 500;
    color: var(--t2); background: var(--bg1);
  }
  .pill.dark  { background: var(--text); color: var(--bg); border-color: var(--text); }
  .pill.ok    { border-color: var(--green); color: var(--green); background: rgba(25,122,57,0.06); }
  .pill.warn  { border-color: #BB6600; color: #BB6600; background: rgba(187,102,0,0.06); }
  .s-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .s-dot.pulse { animation: pulse 1.5s infinite; }
  .role-chip { font-family: var(--display); font-size: 12px; font-weight: 500; color: var(--t3); padding: 4px 10px; border: 1px solid var(--border); border-radius: 4px; }
  .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--text); color: var(--bg); display: flex; align-items: center; justify-content: center; font-family: var(--display); font-size: 12px; font-weight: 700; cursor: pointer; }
  .logout-btn { font-family: var(--display); font-size: 13px; font-weight: 500; color: var(--t3); background: none; border: 1px solid var(--border); padding: 5px 12px; cursor: pointer; border-radius: 4px; transition: all 0.15s; }
  .logout-btn:hover { color: var(--red); border-color: var(--red); }

  /* ── Sidebar + Layout ── */
  .layout { display: flex; flex-direction: column; min-height: calc(100vh - 62px); }
  .content { flex: 1; padding: 28px 32px; background: var(--bg1); overflow-y: auto; }
  .footer { background: var(--bg); border-top: 1px solid var(--border); padding: 18px 32px; display: flex; align-items: center; justify-content: center; }
  .footer-slogan { font-family: var(--display); font-size: 16px; font-weight: 600; color: var(--t2); letter-spacing: 0.06em; font-style: italic; }

  /* ── KPI strip ── */
  .kpi-row { display: grid; gap: 12px; margin-bottom: 20px; }
  .kpi { background: var(--bg); border: 1px solid var(--border); padding: 20px 22px; border-radius: var(--radius); animation: fadeUp 0.4s ease both; }
  .kpi.dark { background: var(--text); }
  .kpi-n { font-family: var(--display); font-size: 30px; font-weight: 700; color: var(--text); line-height: 1; margin-bottom: 6px; letter-spacing: -0.03em; }
  .kpi.dark .kpi-n { color: var(--bg); }
  .kpi.dark .kpi-l { color: #aaa; }
  .kpi.dark .kpi-s { color: #888; }
  .kpi-n.r { color: var(--red); }
  .kpi-n.g { color: var(--green); }
  .kpi-l { font-family: var(--display); font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--t3); }
  .kpi-s { font-family: var(--sans); font-size: 12px; color: var(--t3); margin-top: 4px; }

  /* ── Panels ── */
  .panel { background: var(--bg); border: 1px solid var(--border); padding: 20px 22px; border-radius: var(--radius); }
  .ph { font-family: var(--display); font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--t2); margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
  .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
  .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px; }

  /* ── Sub-tabs ── */
  .stabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
  .stab { font-family: var(--display); font-size: 13px; font-weight: 500; padding: 10px 18px; color: var(--t3); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.15s; }
  .stab.on { color: var(--text); border-bottom-color: var(--text); font-weight: 600; }
  .stab:hover { color: var(--t2); }

  /* ── Table ── */
  .tbl-wrap { border: 1px solid var(--border); overflow-x: auto; background: var(--bg); border-radius: var(--radius); }
  .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
  .tbl th { font-family: var(--display); font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--t2); padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); background: var(--bg1); white-space: nowrap; }
  .tbl td { padding: 10px 14px; border-bottom: 1px solid var(--bg2); color: var(--t2); vertical-align: middle; font-family: var(--sans); }
  .tbl tr:hover td { background: var(--bg1); }
  .tbl tr.hi td { border-left: 2px solid var(--text); }
  .tbl tr.hi:first-child td { background: #FAFAFA; }
  .mn { font-family: var(--mono); font-size: 12px; }

  /* ── Badges ── */
  .badge { display: inline-block; padding: 3px 8px; font-family: var(--display); font-size: 11px; font-weight: 600; border-radius: 4px; }
  .bc   { background: var(--text); color: var(--bg); }
  .bmid { background: #BB6600; color: #fff; }
  .bl   { border: 1px solid var(--b2); color: var(--t2); }
  .bclr { border: 1px solid var(--border); color: var(--t3); }
  .bok  { border: 1px solid var(--green); color: var(--green); background: rgba(25,122,57,0.05); }
  .berr { border: 1px solid var(--red); color: var(--red); background: rgba(198,43,0,0.05); }
  .bblu { border: 1px solid var(--blue); color: var(--blue); background: rgba(21,88,160,0.05); }

  /* ── Score bar ── */
  .sc { display: flex; align-items: center; gap: 8px; min-width: 100px; }
  .sc-n { font-family: var(--mono); font-size: 12px; font-weight: 600; min-width: 28px; color: var(--text); }
  .sc-n.lo { color: var(--t3); }
  .sc-b { flex: 1; height: 3px; background: var(--bg2); border-radius: 2px; }
  .sc-f { height: 100%; background: var(--text); border-radius: 2px; }
  .sc-f.lo { background: var(--border); }

  /* ── Buttons ── */
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border: none; cursor: pointer; font-family: var(--sans); font-size: 13px; font-weight: 600; border-radius: 5px; transition: all 0.15s; white-space: nowrap; }
  .btn-dark  { background: var(--text); color: var(--bg); }
  .btn-dark:hover:not(:disabled)  { background: #2a2a2a; }
  .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--t2); }
  .btn-ghost:hover:not(:disabled) { border-color: var(--text); color: var(--text); }
  .btn-red   { background: transparent; border: 1px solid var(--red); color: var(--red); }
  .btn-red:hover:not(:disabled)   { background: rgba(198,43,0,0.06); }
  .btn-green { background: transparent; border: 1px solid var(--green); color: var(--green); }
  .btn-green:hover:not(:disabled) { background: rgba(25,122,57,0.06); }
  .btn-sm { padding: 5px 12px; font-size: 12px; }
  .btn:disabled { opacity: 0.35; cursor: not-allowed; }

  /* ── Inputs ── */
  .inp { background: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 9px 13px; font-family: var(--sans); font-size: 14px; outline: none; transition: border 0.15s; border-radius: 5px; }
  .inp:focus { border-color: var(--text); }
  .inp::placeholder { color: var(--t4); }
  .inp-row { display: flex; gap: 8px; margin-bottom: 14px; }

  /* ── Donut ── */
  .donut-wrap { display: flex; align-items: center; gap: 20px; }
  .leg { display: flex; flex-direction: column; gap: 8px; flex: 1; }
  .leg-r { display: flex; align-items: center; gap: 8px; }
  .leg-d { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .leg-l { font-size: 11px; color: var(--t2); flex: 1; }
  .leg-v { font-family: var(--mono); font-size: 11px; color: var(--text); }
  .leg-p { font-family: var(--display); font-size: 11px; color: var(--t3); min-width: 36px; text-align: right; }

  /* ── HBar ── */
  .hb-list { display: flex; flex-direction: column; gap: 8px; }
  .hb-row { display: grid; grid-template-columns: 32px 1fr 28px; gap: 8px; align-items: center; }
  .hb-l { font-family: var(--display); font-size: 11px; color: var(--t3); text-align: right; }
  .hb-t { height: 3px; background: var(--bg2); }
  .hb-f { height: 100%; background: var(--text); }
  .hb-c { font-family: var(--display); font-size: 11px; color: var(--t3); }

  /* ── Feature bars ── */
  .fb { margin-bottom: 12px; }
  .fb-h { display: flex; justify-content: space-between; margin-bottom: 6px; }
  .fb-n { font-family: var(--display); font-size: 13px; font-weight: 500; color: var(--t2); }
  .fb-p { font-family: var(--display); font-size: 13px; font-weight: 600; color: var(--text); }
  .fb-bg { height: 3px; background: var(--bg2); border-radius: 2px; }
  .fb-fl { height: 100%; background: var(--text); border-radius: 2px; }

  /* ── Slider mock ── */
  .sld-row { margin-bottom: 18px; }
  .sld-hd { display: flex; justify-content: space-between; margin-bottom: 6px; }
  .sld-l { font-family: var(--sans); font-size: 13px; font-weight: 500; color: var(--t2); }
  .sld-v { font-family: var(--mono); font-size: 12px; color: var(--text); font-weight: 600; }
  .cfg-slider { width: 100%; accent-color: var(--text); cursor: pointer; }

  /* ── Container detail ── */
  .det-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; background: var(--border); margin-bottom: 14px; }
  .dc { background: var(--bg); padding: 12px 14px; }
  .dc-k { font-family: var(--mono); font-size: 7px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--t3); margin-bottom: 4px; }
  .dc-v { font-family: var(--mono); font-size: 12px; color: var(--text); }
  .dc-v.warn { color: var(--red); }

  /* ── Explanation ── */
  .expl { background: var(--bg1); border-left: 3px solid var(--text); padding: 10px 14px; font-family: var(--mono); font-size: 10px; color: var(--t2); line-height: 1.7; margin-bottom: 14px; }

  /* ── AI panel ── */
  .ai-box { background: var(--bg1); border: 1px solid var(--border); padding: 14px; margin-top: 10px; }
  .ai-suggest { border-left: 2px solid var(--b2); padding: 8px 12px; font-family: var(--mono); font-size: 9px; color: var(--t2); line-height: 1.7; margin-bottom: 6px; background: var(--bg); }

  /* ── Workload bar ── */
  .wl-bar { height: 6px; background: var(--bg2); border: 1px solid var(--border); margin-bottom: 5px; }
  .wl-fill { height: 100%; background: var(--text); }

  /* ── Pagination ── */
  .pg { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; flex-wrap: wrap; gap: 8px; }
  .pg-info { font-family: var(--display); font-size: 12px; color: var(--t3); }
  .pg-btns { display: flex; gap: 3px; }
  .pg-b { font-family: var(--display); font-size: 12px; font-weight: 500; padding: 5px 10px; border: 1px solid var(--border); background: transparent; color: var(--t3); cursor: pointer; border-radius: 4px; }
  .pg-b:hover:not(:disabled) { border-color: var(--text); color: var(--text); }
  .pg-b.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .pg-b:disabled { opacity: 0.2; cursor: not-allowed; }
  .pg-sz { display: flex; align-items: center; gap: 6px; font-family: var(--display); font-size: 12px; color: var(--t3); }
  .pg-sz select { background: var(--bg); border: 1px solid var(--border); color: var(--t2); font-family: var(--display); font-size: 12px; padding: 4px 8px; outline: none; border-radius: 4px; }

  /* ── Filter row ── */
  .flt-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; align-items: center; }
  .flt-btn { font-family: var(--display); font-size: 12px; font-weight: 500; padding: 6px 14px; border: 1px solid var(--border); background: transparent; color: var(--t3); cursor: pointer; border-radius: 4px; transition: all 0.12s; }
  .flt-btn:hover { border-color: var(--b2); color: var(--t2); }
  .flt-btn.on { border-color: var(--text); color: var(--text); background: var(--bg2); }
  .srch { flex: 1; min-width: 180px; background: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 8px 13px; font-family: var(--sans); font-size: 13px; outline: none; border-radius: 5px; }
  .srch:focus { border-color: var(--text); }
  .srch::placeholder { color: var(--t4); }

  /* ── Train bar ── */
  .train-bar { background: var(--bg); border: 1px solid var(--border); border-left: 3px solid var(--text); padding: 14px 20px; margin-bottom: 20px; display: flex; align-items: center; gap: 14px; border-radius: var(--radius); animation: fadeUp 0.3s ease; }
  .train-msg { font-family: var(--sans); font-size: 13px; color: var(--t2); margin-bottom: 6px; }
  .train-track { height: 3px; background: var(--bg2); flex: 1; border-radius: 2px; }
  .train-fill { height: 100%; background: var(--text); transition: width 0.5s; border-radius: 2px; }

  /* ── Error / empty ── */
  .err-bar { background: #FFF0EE; border: 1px solid #FFCCCC; border-left: 3px solid var(--red); padding: 10px 16px; font-family: var(--sans); font-size: 13px; color: var(--red); margin-bottom: 14px; border-radius: var(--radius); animation: fadeUp 0.3s ease; }
  .empty { text-align: center; padding: 60px 20px; }
  .empty-hd { font-family: var(--sans); font-size: 15px; font-weight: 600; color: var(--t4); margin-bottom: 8px; }
  .empty-bd { font-family: var(--sans); font-size: 13px; color: var(--t4); line-height: 2; }

  /* ── Upload ── */
  .dropzone { background: var(--bg); border: 1px dashed var(--b2); padding: 22px 26px; cursor: pointer; display: flex; align-items: center; gap: 16px; flex: 1; transition: all 0.2s; border-radius: var(--radius); }
  .dropzone:hover, .dropzone.drag { border-color: var(--text); background: var(--bg1); }
  .drop-name { font-family: var(--sans); font-size: 14px; font-weight: 500; color: var(--text); }
  .drop-hint { font-family: var(--sans); font-size: 12px; color: var(--t3); margin-top: 3px; }

  /* ── Metrics grid ── */
  .met-grid { display: grid; gap: 1px; background: var(--border); margin-bottom: 14px; border-radius: var(--radius); overflow: hidden; }
  .met-cell { background: var(--bg); padding: 18px 20px; text-align: center; }
  .met-cell.hi { background: var(--text); }
  .met-val { font-family: var(--display); font-size: 26px; font-weight: 700; color: var(--text); line-height: 1; letter-spacing: -0.03em; }
  .met-cell.hi .met-val { color: var(--bg); }
  .met-cell.hi .met-lbl { color: #aaa; }
  .met-lbl { font-family: var(--display); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--t3); margin-top: 5px; }

  /* ── Section label ── */
  .s-lbl { font-family: var(--display); font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--t2); margin-bottom: 8px; }

  /* ── Login ── */
  .login-bg { min-height: 100vh; background: var(--bg1); display: flex; align-items: center; justify-content: center; }
  .login-card { background: var(--bg); border: 1px solid var(--border); padding: 44px 44px 36px; width: 400px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.07); animation: fadeUp 0.4s ease; }
  .login-header { display: flex; align-items: center; justify-content: center; margin-bottom: 16px; overflow: hidden; }
  .login-logo-img { width: 280px; height: 90px; object-fit: cover; object-position: center; transform: scale(0.85); }
  .login-sub { display: none; }
  .login-lbl { font-family: var(--display); font-size: 13px; font-weight: 600; color: var(--t2); margin-bottom: 6px; }
  .login-field { margin-bottom: 18px; }
  .role-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 24px; }
  .role-card { border: 1px solid var(--border); padding: 16px 8px; text-align: center; cursor: pointer; transition: all 0.15s; border-radius: 8px; }
  .role-card:hover { border-color: var(--b2); background: var(--bg1); }
  .role-card.sel { border: 2px solid var(--text); background: var(--bg1); }
  .role-icon { font-size: 22px; margin-bottom: 6px; }
  .role-lbl { font-family: var(--display); font-size: 12px; font-weight: 500; color: var(--t3); }
  .role-card.sel .role-lbl { color: var(--text); font-weight: 700; }
  .login-btn { width: 100%; background: var(--text); color: var(--bg); border: none; padding: 13px; font-family: var(--display); font-size: 14px; font-weight: 700; border-radius: 6px; cursor: pointer; transition: background 0.15s; letter-spacing: 0.02em; }
  .login-btn:hover:not(:disabled) { background: #2a2a2a; }
  .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .login-err { background: #FFF0EE; border: 1px solid #FFCCCC; border-radius: 5px; padding: 10px 14px; font-family: var(--sans); font-size: 13px; color: var(--red); margin-bottom: 16px; }

  /* ── Empty state ── */
  .empty { text-align: center; padding: 60px 20px; }
  .empty-hd { font-family: var(--display); font-size: 15px; font-weight: 600; color: var(--t4); margin-bottom: 8px; }
  .empty-bd { font-family: var(--sans); font-size: 13px; color: var(--t4); line-height: 2; }
  .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid var(--bg2); }
  .stat-row:last-child { border-bottom: none; }
  .stat-l { font-family: var(--display); font-size: 10px; font-weight: 500; color: var(--t3); letter-spacing: 0.05em; text-transform: uppercase; }
  .stat-v { font-family: var(--mono); font-size: 11px; font-weight: 700; color: var(--text); }

  /* ── AI chat ── */
  .ai-msg-user { background: var(--text); color: var(--bg); padding: 10px 14px; font-family: var(--mono); font-size: 10px; line-height: 1.6; margin-bottom: 6px; border-radius: 0; }
  .ai-msg-ai   { background: var(--bg1); border: 1px solid var(--border); border-left: 3px solid var(--text); padding: 10px 14px; font-family: var(--mono); font-size: 10px; line-height: 1.7; margin-bottom: 12px; }
  .ai-bullet   { padding: 6px 0 6px 0; border-bottom: 1px solid var(--bg2); color: var(--t2); }
  .ai-bullet:last-child { border-bottom: none; }

  @media (max-width: 900px) {
    .g2, .g3 { grid-template-columns: 1fr; }
    .content { padding: 16px; }
  }
`;

/* ─── ICONS ─────────────────────────────────────────────────── */
const SpinIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>;
const UploadIcon= () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const DlIcon    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;

/* ─── HELPERS ────────────────────────────────────────────────── */
function RiskBadge({ level }) {
  const cls = level==="Critical"?"bc":level==="Low Risk"?"bl":"bclr";
  return <span className={`badge ${cls}`}>{level||"Clear"}</span>;
}
function ScoreBar({ score }) {
  const lo = score < 40;
  return (
    <div className="sc">
      <span className={`sc-n ${lo?"lo":""}`}>{score}</span>
      <div className="sc-b"><div className={`sc-f ${lo?"lo":""}`} style={{width:`${score}%`}}/></div>
    </div>
  );
}
function ActionStatus({ status }) {
  if (!status || status==="pending") return <span className="badge bl">Pending</span>;
  if (status==="inspected")  return <span className="badge bblu">Inspecting</span>;
  if (status==="cleared")    return <span className="badge bok">Cleared</span>;
  if (status==="detained")   return <span className="badge berr">Detained</span>;
  if (status==="seized")     return <span className="badge berr">Seized</span>;
  if (status==="claimed")    return <span className="badge bblu">Claimed</span>;
  return <span className="badge bl">{status}</span>;
}

/* ─── DONUT ─────────────────────────────────────────────────── */
function Donut({ data, total }) {
  const r=42, cx=52, cy=52, sw=9, circ=2*Math.PI*r;
  let off=0;
  const slices=data.map(s=>{const dash=total>0?(s.val/total)*circ:0;const arc={...s,dash,gap:circ-dash,offset:circ-off};off+=dash;return arc;});
  const pct=total>0?((data[0].val/total)*100).toFixed(1):"—";
  return (
    <div className="donut-wrap">
      <svg width={104} height={104} viewBox="0 0 104 104" style={{flexShrink:0}}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg2)" strokeWidth={sw}/>
        {slices.map((s,i)=><circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${s.dash} ${s.gap}`} strokeDashoffset={s.offset} style={{transform:"rotate(-90deg)",transformOrigin:"52px 52px"}}/>)}
        <text x={cx} y={cy-3} textAnchor="middle" fill="var(--text)" style={{fontFamily:"Space Grotesk,sans-serif",fontSize:15,fontWeight:700}}>{pct}%</text>
        <text x={cx} y={cy+11} textAnchor="middle" fill="var(--t3)" style={{fontFamily:"Space Grotesk,sans-serif",fontSize:7,letterSpacing:2}}>CRITICAL</text>
      </svg>
      <div className="leg">
        {slices.map((s,i)=><div className="leg-r" key={i}><div className="leg-d" style={{background:s.color}}/><span className="leg-l">{s.label}</span><span className="leg-v">{s.val.toLocaleString()}</span><span className="leg-p">{total>0?`${((s.val/total)*100).toFixed(1)}%`:"—"}</span></div>)}
      </div>
    </div>
  );
}

/* ─── PAGINATION ─────────────────────────────────────────────── */
function Pager({ total, page, size, onPage, onSize }) {
  if (!total) return null;
  const pages=Math.ceil(total/size), s=page*size+1, e=Math.min((page+1)*size,total);
  const nums=[];
  for(let i=0;i<pages;i++){if(i===0||i===pages-1||Math.abs(i-page)<=1)nums.push(i);else if(nums[nums.length-1]!=="…")nums.push("…");}
  return (
    <div className="pg">
      <span className="pg-info">{s.toLocaleString()}–{e.toLocaleString()} of {total.toLocaleString()}</span>
      <div className="pg-btns">
        <button className="pg-b" disabled={page===0} onClick={()=>onPage(0)}>«</button>
        <button className="pg-b" disabled={page===0} onClick={()=>onPage(page-1)}>‹</button>
        {nums.map((n,i)=>n==="…"?<span key={"d"+i} style={{padding:"5px 3px",color:"var(--t3)",fontSize:10}}>…</span>:<button key={n} className={`pg-b${n===page?" on":""}`} onClick={()=>onPage(n)}>{n+1}</button>)}
        <button className="pg-b" disabled={page>=pages-1} onClick={()=>onPage(page+1)}>›</button>
        <button className="pg-b" disabled={page>=pages-1} onClick={()=>onPage(pages-1)}>»</button>
      </div>
      <div className="pg-sz">
        Rows <select value={size} onChange={e=>{onSize(+e.target.value);onPage(0);}}>
          {[50,100,250,500].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LOGIN SCREEN
══════════════════════════════════════════════════════════════ */
const ROLES = [
  { id:"supervisor",     label:"Supervisor",      icon:"📊" },
  { id:"customs_officer",label:"Customs Officer", icon:"🔍" },
  { id:"risk_analyst",   label:"Risk Analyst",    icon:"🧠" },
];

function LoginScreen({ onLogin }) {
  const [officerId, setOfficerId] = useState("");
  const [password,  setPassword]  = useState("");
  const [role,      setRole]      = useState("customs_officer");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const submit = async () => {
    if (!officerId.trim() || !password.trim()) { setError("Enter Officer ID and password."); return; }
    setLoading(true); setError("");
    try {
      const res = await api("/auth/login", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ officer_id: officerId.trim().toUpperCase(), password, role }),
      });
      onLogin(res.user, res.token);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-header">
          <img src="/sniffr-logo.jpeg" alt="Sniffr" className="login-logo-img" />
        </div>
        {error && <div className="login-err">⚠ {error}</div>}
        <div className="login-field">
          <div className="login-lbl">Officer ID</div>
          <input className="inp" style={{width:"100%"}} placeholder="e.g. OFF-001"
            value={officerId} onChange={e=>setOfficerId(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        <div className="login-field">
          <div className="login-lbl">Password</div>
          <input className="inp" style={{width:"100%"}} type="password" placeholder="••••••••"
            value={password} onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        <div className="login-lbl" style={{marginBottom:10}}>Select Role</div>
        <div className="role-grid">
          {ROLES.map(r=>(
            <div key={r.id} className={`role-card ${role===r.id?"sel":""}`} onClick={()=>setRole(r.id)}>
              <div className="role-icon">{r.icon}</div>
              <div className="role-lbl">{r.label}</div>
            </div>
          ))}
        </div>
        <button className="login-btn" disabled={loading} onClick={submit}>
          {loading ? "Signing In..." : "Sign In →"}
        </button>
        <div style={{marginTop:14,fontFamily:"var(--display)",fontSize:12,color:"var(--t4)",textAlign:"center",letterSpacing:"0.08em"}}>
          Demo: OFF-001 / OFF-002 / OFF-003 / OFF-004 · password: pass123
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SHARED HEADER
══════════════════════════════════════════════════════════════ */
function Header({ user, token, onLogout, statusPill }) {
  const initials = user.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
  const roleName = user.role.replace("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
  return (
    <div className="hdr">
      <div className="logo">
        <img src="/sniffr-icon.png" alt="Sniffr" className="logo-img" />
        <span className="logo-sep">/ {roleName}</span>
      </div>
      <div className="hdr-right">
        {statusPill}
        <div className="role-chip">{user.name}</div>
        <div className="avatar" title={user.name}>{initials}</div>
        <button className="logout-btn" onClick={onLogout}>Sign Out</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUPERVISOR DASHBOARD
══════════════════════════════════════════════════════════════ */
function SupervisorDashboard({ token }) {
  const [tab,         setTab]         = useState("overview");
  const [status,      setStatus]      = useState(null);
  const [summary,     setSummary]     = useState(null);
  const [preds,       setPreds]       = useState([]);
  const [inspections, setInspections] = useState([]);
  const [file,        setFile]        = useState(null);
  const [dragging,    setDragging]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  // All Containers tab
  const [resFilter,   setResFilter]   = useState("all");
  const [resSearch,   setResSearch]   = useState("");
  const [resSort,     setResSort]     = useState("score-desc");
  const [resPgPage,   setResPgPage]   = useState(0);
  const [resPgSize,   setResPgSize]   = useState(100);
  // Inspection Queue tab
  const [qSearch,     setQSearch]     = useState("");
  const [qStatus,     setQStatus]     = useState("all");
  const [qSort,       setQSort]       = useState("score-desc");
  const [qPgPage,     setQPgPage]     = useState(0);
  const [qPgSize,     setQPgSize]     = useState(100);
  // Shared detail modal
  const [modal,       setModal]       = useState(null);
  const fileRef = useRef();

  useEffect(()=>{
    const poll = async () => { try { setStatus(await api("/status", {}, token)); } catch{} };
    poll(); const t=setInterval(poll,3000); return()=>clearInterval(t);
  },[token]);

  useEffect(()=>{
    api("/inspections",{},token).then(setInspections).catch(()=>{});
    const t=setInterval(()=>api("/inspections",{},token).then(setInspections).catch(()=>{}),5000);
    return()=>clearInterval(t);
  },[token]);

  const trainSt   = status?.train_status;
  const isTraining= trainSt?.state==="training"||trainSt?.state==="retraining";
  const isReady   = status?.model_trained;

  const handleFile = f => { if(!f||!f.name.endsWith(".csv")){setError("CSV files only.");return;} setFile(f);setError(""); };
  const handleAnalyze = async () => {
    if(!file||!isReady) return;
    setLoading(true); setError("");
    try {
      const form=new FormData(); form.append("file",file);
      const res=await api("/predict",{method:"POST",body:form},token);
      setSummary(res.summary); setPreds(res.predictions); setTab("overview");
    } catch(e){setError(e.message);}
    setLoading(false);
  };

  // Inspection map: container_id → full inspection record
  const inspMap = {};
  inspections.forEach(i=>{ inspMap[String(i.container_id)]=i; });

  const criticals = preds.filter(p=>p.Risk_Level==="Critical").sort((a,b)=>b.Risk_Score-a.Risk_Score);
  const FINAL_ACTIONS = new Set(["cleared","detained","seized"]);
  const pending  = criticals.filter(p=>{ const a=inspMap[String(p.Container_ID)]?.action; return !a||a==="claimed"; });
  const actioned = criticals.filter(p=>{ const a=inspMap[String(p.Container_ID)]?.action; return a&&a!=="claimed"; });

  // ── All Containers filtering + sorting ──
  const sortFn = (sort) => (a,b) => {
    if(sort==="score-desc") return b.Risk_Score-a.Risk_Score;
    if(sort==="score-asc")  return a.Risk_Score-b.Risk_Score;
    if(sort==="id")         return String(a.Container_ID).localeCompare(String(b.Container_ID));
    if(sort==="origin")     return (a.Origin_Country||"").localeCompare(b.Origin_Country||"");
    return 0;
  };
  const filteredPreds = preds.filter(p=>{
    const mf = resFilter==="all"||(resFilter==="critical"&&p.Risk_Level==="Critical")||(resFilter==="low"&&p.Risk_Level==="Low Risk")||(resFilter==="clear"&&p.Risk_Level==="Clear")||(resFilter==="anomaly"&&p.Anomaly_Flag);
    const s  = resSearch.toLowerCase();
    const ms = !s || String(p.Container_ID||"").includes(s) || String(p.Origin_Country||"").toLowerCase().includes(s) || String(p.HS_Code||"").toLowerCase().includes(s) || String(p.Importer_ID||"").toLowerCase().includes(s);
    return mf && ms;
  }).slice().sort(sortFn(resSort));

  // ── Inspection Queue filtering + sorting ──
  const filteredQueue = criticals.filter(p=>{
    const insp = inspMap[String(p.Container_ID)];
    const action = insp?.action;
    const ms = !qSearch || String(p.Container_ID||"").includes(qSearch) || String(p.Origin_Country||"").toLowerCase().includes(qSearch.toLowerCase()) || String(insp?.officer_id||"").toLowerCase().includes(qSearch.toLowerCase());
    if(!ms) return false;
    if(qStatus==="pending")  return !action||action==="claimed";
    if(qStatus==="actioned") return action&&action!=="claimed";
    if(qStatus==="cleared")  return action==="cleared";
    if(qStatus==="detained") return action==="detained";
    if(qStatus==="seized")   return action==="seized";
    return true;
  }).slice().sort(sortFn(qSort));

  const statusPill = isTraining
    ? <div className="pill warn"><div className="s-dot pulse"/>Training</div>
    : isReady ? <div className="pill dark"><div className="s-dot"/>Model Ready</div>
    : <div className="pill">Offline</div>;

  // ── Detail modal (read-only for supervisor) ──
  const DetailModal = modal ? (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:900,display:"flex",alignItems:"center",justifyContent:"center"}}
      onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
      <div className="panel fade" style={{width:"min(680px,96vw)",maxHeight:"88vh",overflowY:"auto",border:"2px solid var(--text)",animation:"fadeUp 0.2s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <div style={{fontFamily:"var(--mono)",fontSize:15,fontWeight:700}}>{modal.Container_ID}</div>
            <div style={{fontFamily:"var(--display)",fontSize:12,color:"var(--t3)",marginTop:3}}>Container Detail · Supervisor View</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <RiskBadge level={modal.Risk_Level}/>
            <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--t2)"}}>Score {modal.Risk_Score}</span>
            {inspMap[String(modal.Container_ID)] && <ActionStatus status={inspMap[String(modal.Container_ID)].action}/>}
            <button className="btn btn-ghost btn-sm" onClick={()=>setModal(null)}>✕ Close</button>
          </div>
        </div>
        <div className="det-grid" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
          {[
            ["Origin Country",   modal.Origin_Country],
            ["Destination",      modal.Destination_Country],
            ["Destination Port", modal.Destination_Port],
            ["Importer ID",      modal.Importer_ID],
            ["Exporter ID",      modal.Exporter_ID],
            ["HS Code",          modal.HS_Code],
            ["Shipping Line",    modal.Shipping_Line],
            ["Trade Regime",     modal["Trade_Regime (Import / Export / Transit)"]],
            ["Declared Value",   modal.Declared_Value!=null?`$${Number(modal.Declared_Value).toLocaleString()}`:null],
            ["Declared Weight",  modal.Declared_Weight!=null?`${modal.Declared_Weight} kg`:null],
            ["Measured Weight",  modal.Measured_Weight!=null?`${modal.Measured_Weight} kg`:null],
            ["Weight Mismatch",  modal.Weight_Diff_Pct!=null?`${Number(modal.Weight_Diff_Pct).toFixed(1)}%`:null],
            ["Dwell Time",       modal.Dwell_Time_Hours!=null?`${modal.Dwell_Time_Hours}h`:null],
            ["Anomaly Flag",     modal.Anomaly_Flag?"Yes":"No"],
            ["Officer",          inspMap[String(modal.Container_ID)]?.officer_id||"—"],
          ].map(([k,v])=>(
            <div className="dc" key={k}>
              <div className="dc-k">{k}</div>
              <div className={`dc-v ${k==="Weight Mismatch"&&Number(modal.Weight_Diff_Pct||0)>10?"warn":""}`}>{v||"—"}</div>
            </div>
          ))}
        </div>
        {modal.Explanation_Summary && <div className="expl" style={{marginTop:14}}>{modal.Explanation_Summary}</div>}
        {inspMap[String(modal.Container_ID)]?.notes && (
          <div style={{marginTop:10,background:"var(--bg1)",borderLeft:"3px solid var(--b2)",padding:"8px 12px",fontFamily:"var(--mono)",fontSize:10,color:"var(--t2)"}}>
            <span style={{color:"var(--t3)",fontSize:12,fontFamily:"var(--display)",fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase",marginRight:8}}>Officer Notes</span>
            {inspMap[String(modal.Container_ID)].notes}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div>
      {DetailModal}

      {/* Sub-nav */}
      <div className="stabs">
        {[["overview","Overview"],["queue","Inspection Queue"],["results","All Containers"]].map(([id,lbl])=>(
          <div key={id} className={`stab ${tab===id?"on":""}`} onClick={()=>setTab(id)}>{lbl}</div>
        ))}
      </div>

      {/* Training bar */}
      {isTraining && (
        <div className="train-bar">
          <SpinIcon/>
          <div style={{flex:1}}>
            <div className="train-msg">{trainSt.message}</div>
            <div className="train-track"><div className="train-fill" style={{width:`${trainSt.progress}%`}}/></div>
          </div>
        </div>
      )}

      {/* Upload row — always visible */}
      <div style={{display:"flex",gap:10,marginBottom:18}}>
        <div className={`dropzone ${dragging?"drag":""}`}
          onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
          onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}}
          onClick={()=>fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>e.target.files[0]&&handleFile(e.target.files[0])}/>
          <UploadIcon/>
          {file ? <div><div className="drop-name">{file.name}</div><div className="drop-hint">{(file.size/1024).toFixed(1)} KB · click to change</div></div>
                : <div><div className="drop-name" style={{color:"var(--t3)"}}>Drop real-time CSV or click to browse</div></div>}
        </div>
        <button className="btn btn-dark" style={{minWidth:160}} disabled={!file||loading||!isReady} onClick={handleAnalyze}>
          {loading?<><SpinIcon/>Analyzing...</>:"Run Analysis"}
        </button>
        {summary && <a href={`http://localhost:8000/api/download`} style={{textDecoration:"none"}}><button className="btn btn-ghost"><DlIcon/>Export</button></a>}
      </div>

      {error && <div className="err-bar">⚠ {error}</div>}

      {/* ══ OVERVIEW TAB ══ */}
      {tab==="overview" && (
        summary ? (
          <>
            <div className="kpi-row" style={{gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr"}}>
              <div className="kpi dark">
                <div className="kpi-n" style={{color:"#fff",fontSize:32}}>{summary.total.toLocaleString()}</div>
                <div className="kpi-l">Total Containers</div>
                <div className="kpi-s">Current batch</div>
              </div>
              <div className="kpi"><div className="kpi-n r">{summary.critical_count}</div><div className="kpi-l">Critical</div><div className="kpi-s">{summary.critical_pct}%</div></div>
              <div className="kpi"><div className="kpi-n">{summary.anomaly_count ?? 0}</div><div className="kpi-l">Anomalies</div><div className="kpi-s">{(summary.anomaly_pct ?? (summary.total > 0 ? (summary.anomaly_count/summary.total*100).toFixed(2) : 0))}%</div></div>
              <div className="kpi"><div className="kpi-n g">{actioned.length}</div><div className="kpi-l">Inspected</div><div className="kpi-s">{criticals.length>0?Math.round(actioned.length/criticals.length*100):0}%</div></div>
              <div className="kpi"><div className="kpi-n r">{pending.length}</div><div className="kpi-l">Pending</div><div className="kpi-s">Unactioned</div></div>
            </div>

            {criticals.length > 0 && (
              <div className="panel" style={{marginBottom:12}}>
                <div className="ph">Shift Workload</div>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:24,alignItems:"center"}}>
                  <div>
                    <div className="s-lbl" style={{marginBottom:6}}>Inspection Progress · {actioned.length} / {criticals.length}</div>
                    <div className="wl-bar"><div className="wl-fill" style={{width:`${criticals.length>0?Math.round(actioned.length/criticals.length*100):0}%`}}/></div>
                    <div style={{fontFamily:"var(--display)",fontSize:12,color:"var(--t3)",marginTop:4}}>{criticals.length>0?Math.round(actioned.length/criticals.length*100):0}% complete</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:"var(--mono)",fontSize:28,fontWeight:700}}>{inspections.filter(i=>i.action!=="claimed").length}</div>
                    <div className="kpi-l">Actions Recorded</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:"var(--mono)",fontSize:28,fontWeight:700}}>{pending.length}</div>
                    <div className="kpi-l" style={{color:"var(--red)"}}>Still Pending</div>
                  </div>
                </div>
              </div>
            )}

            <div className="g2">
              <div className="panel">
                <div className="ph">Critical Queue — Top 10 <span style={{fontWeight:400,color:"var(--t4)",fontSize:12}}>(click to view)</span></div>
                <table className="tbl">
                  <thead><tr><th>#</th><th>Container ID</th><th>Score</th><th>Origin</th><th>Officer</th><th>Status</th></tr></thead>
                  <tbody>
                    {criticals.slice(0,10).map((p,i)=>(
                      <tr key={p.Container_ID} className={i<3?"hi":""} style={{cursor:"pointer"}} onClick={()=>setModal(p)}>
                        <td className="mn">{i+1}</td>
                        <td className="mn" style={{fontWeight:600}}>{p.Container_ID}</td>
                        <td><ScoreBar score={p.Risk_Score}/></td>
                        <td className="mn">{p.Origin_Country||"—"}</td>
                        <td className="mn" style={{color:"var(--t3)",fontSize:10}}>{inspMap[String(p.Container_ID)]?.officer_id||"—"}</td>
                        <td><ActionStatus status={inspMap[String(p.Container_ID)]?.action}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div className="panel">
                  <div className="ph">Risk Breakdown</div>
                  <Donut total={summary.total} data={[
                    {val:summary.critical_count, label:"Critical", color:"#111111"},
                    {val:summary.low_risk_count,  label:"Low Risk", color:"#BDBDBD"},
                    {val:summary.clear_count,     label:"Clear",    color:"#EBEBEB"},
                  ]}/>
                </div>
                {summary.country_breakdown && (
                  <div className="panel">
                    <div className="ph">Critical by Origin</div>
                    <div className="hb-list">
                      {Object.entries(summary.country_breakdown).slice(0,6).map(([c,n])=>{
                        const mx=Math.max(...Object.values(summary.country_breakdown));
                        return <div className="hb-row" key={c}><span className="hb-l">{c}</span><div className="hb-t"><div className="hb-f" style={{width:`${(n/mx)*100}%`}}/></div><span className="hb-c">{n}</span></div>;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="empty">
            <div className="empty-hd">No Data Loaded</div>
            <div className="empty-bd">Upload a real-time CSV above to begin analysis.</div>
          </div>
        )
      )}

      {/* ══ INSPECTION QUEUE TAB ══ */}
      {tab==="queue" && (
        summary ? (
          <>
            {/* Filter + search */}
            <div className="flt-row">
              {[["all","All"],["pending","Pending"],["actioned","Actioned"],["cleared","Cleared"],["detained","Detained"],["seized","Seized"]].map(([id,lbl])=>(
                <button key={id} className={`flt-btn ${qStatus===id?"on":""}`} onClick={()=>{setQStatus(id);setQPgPage(0);}}>
                  {lbl}
                  {id==="pending"  && pending.length>0  && <span style={{marginLeft:5,background:"var(--red)",color:"#fff",borderRadius:8,padding:"2px 6px",fontSize:11}}>{pending.length}</span>}
                  {id==="actioned" && actioned.length>0 && <span style={{marginLeft:5,background:"var(--text)",color:"var(--bg)",borderRadius:8,padding:"2px 6px",fontSize:11}}>{actioned.length}</span>}
                </button>
              ))}
              <input className="srch" placeholder="Search by ID, origin, officer..."
                value={qSearch} onChange={e=>{setQSearch(e.target.value);setQPgPage(0);}}/>
            </div>

            {/* Sort + count row */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--t3)"}}>
                {filteredQueue.length} containers · {actioned.length} actioned · {pending.length} pending
              </span>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontFamily:"var(--display)",fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)"}}>Sort</span>
                {[["score-desc","Score ↓"],["score-asc","Score ↑"],["id","ID"],["origin","Origin"]].map(([v,lbl])=>(
                  <button key={v} className={`flt-btn ${qSort===v?"on":""}`} style={{padding:"4px 10px",fontSize:12}} onClick={()=>setQSort(v)}>{lbl}</button>
                ))}
              </div>
            </div>

            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>#</th><th>Container ID</th><th>Score</th><th>Origin</th><th>HS Code</th><th>Primary Flag</th><th>Officer</th><th>Notes</th><th>Status</th></tr></thead>
                <tbody>
                  {filteredQueue.slice(qPgPage*qPgSize,(qPgPage+1)*qPgSize).map((p,i)=>{
                    const insp = inspMap[String(p.Container_ID)];
                    return (
                      <tr key={p.Container_ID} className={i<3&&qStatus==="all"?"hi":""} style={{cursor:"pointer"}} onClick={()=>setModal(p)}>
                        <td className="mn">{qPgPage*qPgSize+i+1}</td>
                        <td className="mn" style={{fontWeight:600}}>{p.Container_ID}</td>
                        <td><ScoreBar score={p.Risk_Score}/></td>
                        <td className="mn">{p.Origin_Country||"—"}</td>
                        <td className="mn">{String(p.HS_Code||"—")}</td>
                        <td style={{fontSize:10,color:"var(--t2)",maxWidth:200}}>{(p.Explanation_Summary||"").split(".")[0]}</td>
                        <td className="mn" style={{color:"var(--t3)"}}>{insp?.officer_id||"—"}</td>
                        <td style={{fontSize:12,color:"var(--t3)",fontFamily:"var(--display)",maxWidth:160}}>{insp?.notes||"—"}</td>
                        <td><ActionStatus status={insp?.action}/></td>
                      </tr>
                    );
                  })}
                  {filteredQueue.length===0 && (
                    <tr><td colSpan={9} style={{textAlign:"center",padding:24,color:"var(--t3)",fontFamily:"var(--mono)",fontSize:10}}>
                      {qSearch?"No containers match your search":"No containers with this status"}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pager total={filteredQueue.length} page={qPgPage} size={qPgSize} onPage={setQPgPage} onSize={setQPgSize}/>
          </>
        ) : <div className="empty"><div className="empty-hd">Run analysis first</div></div>
      )}

      {/* ══ ALL CONTAINERS TAB ══ */}
      {tab==="results" && (
        preds.length > 0 ? (
          <>
            {/* Filter + search */}
            <div className="flt-row">
              {[["all","All"],["critical","Critical"],["low","Low Risk"],["clear","Clear"],["anomaly","Anomaly"]].map(([id,lbl])=>(
                <button key={id} className={`flt-btn ${resFilter===id?"on":""}`} onClick={()=>{setResFilter(id);setResPgPage(0);}}>{lbl}</button>
              ))}
              <input className="srch" placeholder="Search by ID, origin, HS code, importer..."
                value={resSearch} onChange={e=>{setResSearch(e.target.value);setResPgPage(0);}}/>
            </div>

            {/* Sort + count row */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--t3)"}}>{filteredPreds.length.toLocaleString()} containers</span>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontFamily:"var(--display)",fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)"}}>Sort</span>
                {[["score-desc","Score ↓"],["score-asc","Score ↑"],["id","ID"],["origin","Origin"]].map(([v,lbl])=>(
                  <button key={v} className={`flt-btn ${resSort===v?"on":""}`} style={{padding:"4px 10px",fontSize:12}} onClick={()=>setResSort(v)}>{lbl}</button>
                ))}
              </div>
            </div>

            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Container ID</th><th>Risk Score</th><th>Risk Level</th><th>Origin</th><th>HS Code</th><th>Importer</th><th>Anomaly</th><th>Inspection Status</th><th>Explanation</th></tr></thead>
                <tbody>
                  {filteredPreds.slice(resPgPage*resPgSize,(resPgPage+1)*resPgSize).map(p=>(
                    <tr key={p.Container_ID} className={p.Risk_Level==="Critical"?"hi":""} style={{cursor:"pointer"}} onClick={()=>setModal(p)}>
                      <td className="mn" style={{fontWeight:p.Risk_Level==="Critical"?600:400}}>{p.Container_ID}</td>
                      <td><ScoreBar score={p.Risk_Score}/></td>
                      <td><RiskBadge level={p.Risk_Level}/></td>
                      <td className="mn">{p.Origin_Country||"—"}</td>
                      <td className="mn">{String(p.HS_Code||"—")}</td>
                      <td className="mn" style={{fontSize:10}}>{p.Importer_ID||"—"}</td>
                      <td>{p.Anomaly_Flag?<span className="badge bc">⚑</span>:<span style={{color:"var(--t4)"}}>—</span>}</td>
                      <td><ActionStatus status={inspMap[String(p.Container_ID)]?.action}/></td>
                      <td style={{fontSize:10,color:"var(--t2)",maxWidth:260}}>{(p.Explanation_Summary||"").slice(0,80)}{(p.Explanation_Summary||"").length>80?"…":""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager total={filteredPreds.length} page={resPgPage} size={resPgSize} onPage={setResPgPage} onSize={setResPgSize}/>
          </>
        ) : <div className="empty"><div className="empty-hd">Run analysis first</div></div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CUSTOMS OFFICER DASHBOARD
══════════════════════════════════════════════════════════════ */
function OfficerDashboard({ user, token }) {
  const [tab,        setTab]        = useState("queue");
  const [status,     setStatus]     = useState(null);
  const [preds,      setPreds]      = useState([]);
  const [myInsps,    setMyInsps]    = useState([]);
  const [actionMsg,  setActionMsg]  = useState("");
  const [file,       setFile]       = useState(null);
  const [dragging,   setDragging]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [lookupSearch, setLookupSearch] = useState("");
  const [lookupPage,   setLookupPage]   = useState(0);
  const [lookupSize,   setLookupSize]   = useState(100);
  const [lookupRisk,   setLookupRisk]   = useState("");
  const [lookupAnomaly,setLookupAnomaly]= useState("");
  const [lookupSort,   setLookupSort]   = useState("score-desc");
  const [allInsps,   setAllInsps]   = useState([]);
  // Modal state — used for action-with-notes AND container detail popup
  const [modal,      setModal]      = useState(null); // {type:"action"|"detail", container, action?, finalStatus?}
  const [noteText,   setNoteText]   = useState("");
  // History filter/sort state
  const [hSearch,    setHSearch]    = useState("");
  const [hAction,    setHAction]    = useState("all");
  const [hSort,      setHSort]      = useState("newest");
  const fileRef = useRef();

  useEffect(()=>{
    const poll=async()=>{try{setStatus(await api("/status",{},token));}catch{}};
    poll(); const t=setInterval(poll,3000); return()=>clearInterval(t);
  },[token]);

  const loadMyHistory = useCallback(async()=>{
    try { setMyInsps(await api("/inspections/mine",{},token)); } catch{}
  },[token]);

  const loadAllInsps = useCallback(async()=>{
    try { setAllInsps(await api("/inspections",{},token)); } catch{}
  },[token]);

  useEffect(()=>{ loadMyHistory(); loadAllInsps(); },[loadMyHistory,loadAllInsps]);

  const handleFile = f=>{ if(!f||!f.name.endsWith(".csv")){setError("CSV only.");return;} setFile(f);setError(""); };
  const handleAnalyze = async()=>{
    if(!file) return; setLoading(true); setError("");
    try {
      const form=new FormData(); form.append("file",file);
      const res=await api("/predict",{method:"POST",body:form},token);
      setPreds(res.predictions); setTab("queue");
    } catch(e){setError(e.message);}
    setLoading(false);
  };

  // Open action modal with optional notes
  const openAction = (container, action, finalStatus=null) => {
    setNoteText("");
    setModal({type:"action", container, action, finalStatus});
  };

  const confirmAction = async()=>{
    const {container, action, finalStatus} = modal;
    try {
      await api(`/container/${container.Container_ID}/action`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action, final_status:finalStatus, notes:noteText.trim()||undefined}),
      }, token);
      setActionMsg(`✓ ${container.Container_ID} marked as ${action}`);
      setModal(null); setNoteText("");
      loadMyHistory(); loadAllInsps();
      setTimeout(()=>setActionMsg(""),3000);
    } catch(e){ setError(e.message); setModal(null); }
  };

  const inspMap={};
  allInsps.forEach(i=>{inspMap[String(i.container_id)]=i;});
  const myInspMap={};
  myInsps.forEach(i=>{myInspMap[String(i.container_id)]=i;});

  const isTraining = status?.train_status?.state==="training"||status?.train_status?.state==="retraining";
  const isReady    = status?.model_trained;

  const FINAL_ACTIONS = new Set(["cleared","detained","seized"]);
  const criticals = preds.filter(p=>p.Risk_Level==="Critical").sort((a,b)=>b.Risk_Score-a.Risk_Score);

  // ── Queue search/filter state ──
  const [qSearch,   setQSearch]   = useState("");
  const [qFilter,   setQFilter]   = useState("all");   // all | mine | available | anomaly
  const [qPage,     setQPage]     = useState(0);
  const [qSize,     setQSize]     = useState(50);

  // Applies search + filter to any list of critical containers
  const applyQFilter = (list) => {
    const s = qSearch.toLowerCase();
    return list.filter(p => {
      const matchSearch = !s ||
        String(p.Container_ID||"").includes(s) ||
        String(p.Origin_Country||"").toLowerCase().includes(s) ||
        String(p.HS_Code||"").toLowerCase().includes(s) ||
        String(p.Importer_ID||"").toLowerCase().includes(s);
      if (!matchSearch) return false;
      const insp = myInspMap[String(p.Container_ID)];
      const allInsp = inspMap[String(p.Container_ID)];
      if (qFilter === "mine")      return insp && !FINAL_ACTIONS.has(insp.action);
      if (qFilter === "available") return !allInsp || (!FINAL_ACTIONS.has(allInsp.action) && allInsp.officer_id !== user.officer_id);
      if (qFilter === "anomaly")   return !!p.Anomaly_Flag;
      return true; // "all"
    });
  };

  // My queue: containers I've claimed but NOT yet given a final disposition
  const myQueue   = criticals.filter(p=>{
    const insp = myInspMap[String(p.Container_ID)];
    return insp && !FINAL_ACTIONS.has(insp.action);
  });
  // Available: not claimed by anyone, or only has a non-final action from someone else
  const available = criticals.filter(p=>{
    const insp = inspMap[String(p.Container_ID)];
    return !insp || (!FINAL_ACTIONS.has(insp.action) && insp.officer_id !== user.officer_id);
  });

  // Filtered view for queue tab — combines all criticals then splits for display
  const qFiltered = applyQFilter(criticals);
  const qMyFiltered        = qFiltered.filter(p=>{ const i=myInspMap[String(p.Container_ID)]; return i&&!FINAL_ACTIONS.has(i.action); });
  const qAvailableFiltered = qFiltered.filter(p=>{ const i=inspMap[String(p.Container_ID)]; return !i||(!FINAL_ACTIONS.has(i.action)&&i.officer_id!==user.officer_id); });
  const qAvailablePage     = qAvailableFiltered.slice(qPage*qSize, (qPage+1)*qSize);

  // Lookup filtered + sorted results
  const lookupFiltered = preds.filter(p=>{
    const s = lookupSearch.toLowerCase();
    const matchText = !s ||
      String(p.Container_ID||"").includes(s) ||
      String(p.Origin_Country||"").toLowerCase().includes(s) ||
      String(p.HS_Code||"").toLowerCase().includes(s) ||
      String(p.Importer_ID||"").toLowerCase().includes(s);
    if (!matchText) return false;
    if (lookupRisk && p.Risk_Level !== lookupRisk) return false;
    if (lookupAnomaly === "1" && !p.Anomaly_Flag) return false;
    return true;
  }).slice().sort((a,b)=>{
    if (lookupSort==="score-desc") return (b.Risk_Score||0)-(a.Risk_Score||0);
    if (lookupSort==="score-asc")  return (a.Risk_Score||0)-(b.Risk_Score||0);
    if (lookupSort==="id")         return String(a.Container_ID||"").localeCompare(String(b.Container_ID||""));
    if (lookupSort==="origin")     return String(a.Origin_Country||"").localeCompare(String(b.Origin_Country||""));
    if (lookupSort==="status") {
      const sa = myInspMap[String(a.Container_ID)]?.action||"";
      const sb = myInspMap[String(b.Container_ID)]?.action||"";
      return sa.localeCompare(sb);
    }
    return 0;
  });

  // Action modal button config
  const ACTION_BTNS = [
    {label:"Mark Inspected", action:"inspected", finalStatus:"Critical", cls:"btn-dark"},
    {label:"Clear & Release", action:"cleared",  finalStatus:"Clear",    cls:"btn-green"},
    {label:"Detain",          action:"detained", finalStatus:"Critical",  cls:"btn-red"},
    {label:"Seize",           action:"seized",   finalStatus:"Critical",  cls:"btn-ghost"},
  ];

  return (
    <div>
      <div className="stabs">
        {[["queue","My Queue"],["lookup","Container Lookup"],["history","My History"]].map(([id,lbl])=>(
          <div key={id} className={`stab ${tab===id?"on":""}`} onClick={()=>setTab(id)}>{lbl}</div>
        ))}
      </div>

      {isTraining && (
        <div className="train-bar">
          <SpinIcon/>
          <div style={{flex:1}}>
            <div className="train-msg">{status.train_status.message}</div>
            <div className="train-track"><div className="train-fill" style={{width:`${status.train_status.progress}%`}}/></div>
          </div>
        </div>
      )}

      {error    && <div className="err-bar">⚠ {error}</div>}
      {actionMsg && <div style={{background:"#F0FFF4",border:"1px solid #C6F6D5",borderLeft:"3px solid var(--green)",padding:"10px 16px",fontFamily:"var(--mono)",fontSize:11,color:"var(--green)",marginBottom:14}}>{actionMsg}</div>}

      {/* ── ACTION / DETAIL MODAL ── */}
      {modal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:900,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={e=>{if(e.target===e.currentTarget){setModal(null);setNoteText("");}}}>
          <div className="panel fade" style={{width:"min(680px,96vw)",maxHeight:"88vh",overflowY:"auto",border:"2px solid var(--text)",animation:"fadeUp 0.2s ease"}}>

            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{fontFamily:"var(--mono)",fontSize:15,fontWeight:700}}>{modal.container.Container_ID}</div>
                <div style={{fontFamily:"var(--display)",fontSize:12,color:"var(--t3)",marginTop:3}}>
                  {modal.type==="action" ? `Recording: ${modal.action}` : "Container Detail"}
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <RiskBadge level={modal.container.Risk_Level}/>
                <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--t2)"}}>Score {modal.container.Risk_Score}</span>
                <button className="btn btn-ghost btn-sm" onClick={()=>{setModal(null);setNoteText("");}}>✕ Close</button>
              </div>
            </div>

            {/* Detail grid — all available fields */}
            <div className="det-grid" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
              {[
                ["Origin Country",    modal.container.Origin_Country],
                ["Destination",       modal.container.Destination_Country],
                ["Destination Port",  modal.container.Destination_Port],
                ["Importer ID",       modal.container.Importer_ID],
                ["Exporter ID",       modal.container.Exporter_ID],
                ["HS Code",           modal.container.HS_Code],
                ["Shipping Line",     modal.container.Shipping_Line],
                ["Trade Regime",      modal.container["Trade_Regime (Import / Export / Transit)"]],
                ["Declared Value",    modal.container.Declared_Value!=null?`$${Number(modal.container.Declared_Value).toLocaleString()}`:null],
                ["Declared Weight",   modal.container.Declared_Weight!=null?`${modal.container.Declared_Weight} kg`:null],
                ["Measured Weight",   modal.container.Measured_Weight!=null?`${modal.container.Measured_Weight} kg`:null],
                ["Weight Mismatch",   modal.container.Weight_Diff_Pct!=null?`${Number(modal.container.Weight_Diff_Pct).toFixed(1)}%`:null],
                ["Dwell Time",        modal.container.Dwell_Time_Hours!=null?`${modal.container.Dwell_Time_Hours}h`:null],
                ["Anomaly Flag",      modal.container.Anomaly_Flag?"Yes":"No"],
                ["Risk Score",        modal.container.Risk_Score],
              ].map(([k,v])=>(
                <div className="dc" key={k}>
                  <div className="dc-k">{k}</div>
                  <div className={`dc-v ${k==="Weight Mismatch"&&Number(modal.container.Weight_Diff_Pct||0)>10?"warn":""}`}>{v||"—"}</div>
                </div>
              ))}
            </div>

            {modal.container.Explanation_Summary && (
              <div className="expl" style={{marginTop:14}}>{modal.container.Explanation_Summary}</div>
            )}

            {/* Notes input — shown in action mode or always for detail */}
            <div style={{marginTop:14}}>
              <div className="s-lbl" style={{marginBottom:6}}>Inspection Notes (optional)</div>
              <textarea className="inp" style={{width:"100%",minHeight:64,resize:"vertical",fontSize:11,fontFamily:"var(--sans)"}}
                placeholder="Add notes about this inspection decision..."
                value={noteText} onChange={e=>setNoteText(e.target.value)}/>
            </div>

            {/* Action buttons */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:14}}>
              {ACTION_BTNS.map(b=>(
                <button key={b.action} className={`btn ${b.cls}`}
                  onClick={()=>{
                    if(modal.type==="action" && modal.action===b.action){ confirmAction(); }
                    else { setModal({...modal,type:"action",action:b.action,finalStatus:b.finalStatus}); }
                  }}>
                  {modal.type==="action" && modal.action===b.action ? `✓ Confirm: ${b.label}` : b.label}
                </button>
              ))}
              <button className="btn btn-ghost" style={{marginLeft:"auto"}} onClick={()=>{setModal(null);setNoteText("");}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MY QUEUE ── */}
      {tab==="queue" && (
        <>
          {/* Upload */}
          <div style={{display:"flex",gap:10,marginBottom:18}}>
            <div className={`dropzone ${dragging?"drag":""}`}
              onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
              onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}}
              onClick={()=>fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>e.target.files[0]&&handleFile(e.target.files[0])}/>
              <UploadIcon/>
              {file?<div><div className="drop-name">{file.name}</div></div>:<div className="drop-name" style={{color:"var(--t3)"}}>Upload real-time CSV to load containers</div>}
            </div>
            <button className="btn btn-dark" disabled={!file||loading||!isReady} onClick={handleAnalyze}>
              {loading?<><SpinIcon/>Loading...</>:"Load Batch"}
            </button>
          </div>

          {preds.length > 0 ? (
            <>
              {/* ── Search + Filter bar ── */}
              <div className="flt-row">
                {[["all","All High Priority"],["mine","My Assigned"],["available","Available"],["anomaly","Anomaly"]].map(([id,lbl])=>(
                  <button key={id} className={`flt-btn ${qFilter===id?"on":""}`}
                    onClick={()=>{setQFilter(id);setQPage(0);}}>
                    {lbl}
                    {id==="mine"      && myQueue.length>0      && <span style={{marginLeft:5,background:"var(--text)",color:"var(--bg)",borderRadius:8,padding:"2px 6px",fontSize:11}}>{myQueue.length}</span>}
                    {id==="available" && available.length>0    && <span style={{marginLeft:5,background:"var(--text)",color:"var(--bg)",borderRadius:8,padding:"2px 6px",fontSize:11}}>{available.length}</span>}
                  </button>
                ))}
                <input className="srch" placeholder="Search by ID, origin, HS code, importer..."
                  value={qSearch} onChange={e=>{setQSearch(e.target.value);setQPage(0);}}/>
              </div>

              {/* Result count */}
              <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--t3)",marginBottom:12}}>
                {qFilter==="all"       && `${qFiltered.length} critical & moderate containers`}
                {qFilter==="mine"      && `${qMyFiltered.length} assigned to me`}
                {qFilter==="available" && `${qAvailableFiltered.length} available`}
                {qFilter==="anomaly"   && `${qFiltered.length} anomaly flagged`}
              </div>

              {/* ── My Assigned section — shown when filter is "all" or "mine" ── */}
              {(qFilter==="all"||qFilter==="mine") && qMyFiltered.length > 0 && (
                <div className="panel" style={{marginBottom:12}}>
                  <div className="ph">My Assigned Containers ({qMyFiltered.length})</div>
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead><tr><th>#</th><th>Container ID</th><th>Score</th><th>Origin</th><th>HS Code</th><th>Primary Flag</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>
                        {qMyFiltered.map((p,i)=>(
                          <tr key={p.Container_ID} className="hi" style={{cursor:"pointer"}} onClick={()=>setModal({type:"detail",container:p})}>
                            <td className="mn">{i+1}</td>
                            <td className="mn" style={{fontWeight:600}}>{p.Container_ID}</td>
                            <td><ScoreBar score={p.Risk_Score}/></td>
                            <td className="mn">{p.Origin_Country||"—"}</td>
                            <td className="mn">{String(p.HS_Code||"—")}</td>
                            <td style={{fontSize:10,color:"var(--t2)"}}>{(p.Explanation_Summary||"").split(".")[0]}</td>
                            <td><ActionStatus status={myInspMap[String(p.Container_ID)]?.action}/></td>
                            <td onClick={e=>e.stopPropagation()}>
                              <div style={{display:"flex",gap:4}}>
                                <button className="btn btn-green btn-sm" onClick={()=>openAction(p,"cleared","Clear")}>Clear</button>
                                <button className="btn btn-red btn-sm" onClick={()=>openAction(p,"detained","Critical")}>Detain</button>
                                <button className="btn btn-ghost btn-sm" onClick={()=>openAction(p,"seized","Critical")}>Seize</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Available / filtered containers ── */}
              {(qFilter==="all"||qFilter==="available"||qFilter==="anomaly") && (
                <div className="panel">
                  <div className="ph">
                    {qFilter==="mine" ? "" :
                     qFilter==="available" ? `Available Critical Containers (${qAvailableFiltered.length})` :
                     qFilter==="anomaly"   ? `Anomaly Flagged (${qFiltered.length})` :
                     `Available Critical Containers (${qAvailableFiltered.length})`}
                  </div>
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead><tr><th>#</th><th>Container ID</th><th>Score</th><th>Origin</th><th>HS Code</th><th>Importer</th><th>Anomaly</th><th>Primary Flag</th><th>Action</th></tr></thead>
                      <tbody>
                        {(qFilter==="anomaly" ? qFiltered : qAvailablePage).map((p,i)=>(
                          <tr key={p.Container_ID} style={{cursor:"pointer"}} onClick={()=>setModal({type:"detail",container:p})}>
                            <td className="mn">{qPage*qSize+i+1}</td>
                            <td className="mn">{p.Container_ID}</td>
                            <td><ScoreBar score={p.Risk_Score}/></td>
                            <td className="mn">{p.Origin_Country||"—"}</td>
                            <td className="mn">{String(p.HS_Code||"—")}</td>
                            <td className="mn" style={{fontSize:10}}>{p.Importer_ID||"—"}</td>
                            <td>{p.Anomaly_Flag?<span className="badge bc">⚑</span>:<span style={{color:"var(--t4)"}}>—</span>}</td>
                            <td style={{fontSize:10,color:"var(--t2)"}}>{(p.Explanation_Summary||"").split(".")[0]}</td>
                            <td onClick={e=>e.stopPropagation()}>
                              <button className="btn btn-dark btn-sm" onClick={()=>openAction(p,"inspected","Critical")}>Inspect</button>
                            </td>
                          </tr>
                        ))}
                        {qFilter!=="anomaly" && qAvailableFiltered.length===0 && (
                          <tr><td colSpan={9} style={{textAlign:"center",padding:"20px",color:"var(--t3)",fontFamily:"var(--mono)",fontSize:10}}>
                            {qSearch ? "No containers match your search" : "All critical containers have been assigned"}
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {qFilter!=="anomaly" && <Pager total={qAvailableFiltered.length} page={qPage} size={qSize} onPage={setQPage} onSize={setQSize}/>}
                </div>
              )}

              {/* Mine-only view with no results */}
              {qFilter==="mine" && qMyFiltered.length===0 && (
                <div className="empty">
                  <div className="empty-hd">{qSearch?"No matches":"No assigned containers"}</div>
                  <div className="empty-bd">{qSearch?"Try a different search term.":"Inspect a container from the Available list to assign it to yourself."}</div>
                </div>
              )}
            </>
          ) : (
            <div className="empty"><div className="empty-hd">No containers loaded</div><div className="empty-bd">Upload real-time CSV above to view your inspection queue.</div></div>
          )}
        </>
      )}

      {/* ── LOOKUP ── */}
      {tab==="lookup" && (
        <>
          {preds.length > 0 ? (
            <>
              <div className="flt-row">
                {["","Critical","Low Risk","Clear"].map(v=>(
                  <button key={v} className={`flt-btn ${lookupRisk===v?"on":""}`}
                    onClick={()=>{setLookupRisk(v);setLookupPage(0);}}>
                    {v||"All Risk"}
                  </button>
                ))}
                <button className={`flt-btn ${lookupAnomaly==="1"?"on":""}`}
                  onClick={()=>{setLookupAnomaly(a=>a==="1"?"":"1");setLookupPage(0);}}>
                  ⚑ Anomaly
                </button>
                <input className="srch" placeholder="Search by ID, origin, importer, HS code..."
                  value={lookupSearch}
                  onChange={e=>{setLookupSearch(e.target.value);setLookupPage(0);}}/>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
                <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--t3)"}}>
                  {lookupFiltered.length.toLocaleString()} of {preds.length.toLocaleString()} containers
                </span>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontFamily:"var(--display)",fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)"}}>Sort</span>
                  {[["score-desc","Score ↓"],["score-asc","Score ↑"],["id","ID"],["origin","Origin"],["status","Status"]].map(([v,lbl])=>(
                    <button key={v} className={`flt-btn ${lookupSort===v?"on":""}`}
                      style={{padding:"4px 10px",fontSize:12}}
                      onClick={()=>{setLookupSort(v);setLookupPage(0);}}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Container ID</th><th>Score</th><th>Risk Level</th><th>Origin</th><th>HS Code</th><th>Importer</th><th>Anomaly</th><th>My Status</th></tr></thead>
                  <tbody>
                    {lookupFiltered.slice(lookupPage*lookupSize,(lookupPage+1)*lookupSize).map(p=>(
                      <tr key={p.Container_ID} style={{cursor:"pointer"}} onClick={()=>setModal({type:"detail",container:p})}>
                        <td className="mn">{p.Container_ID}</td>
                        <td><ScoreBar score={p.Risk_Score}/></td>
                        <td><RiskBadge level={p.Risk_Level}/></td>
                        <td className="mn">{p.Origin_Country||"—"}</td>
                        <td className="mn">{p.HS_Code||"—"}</td>
                        <td className="mn" style={{fontSize:10}}>{p.Importer_ID||"—"}</td>
                        <td>{p.Anomaly_Flag?<span className="badge bc">⚑</span>:<span style={{color:"var(--t4)"}}>—</span>}</td>
                        <td><ActionStatus status={myInspMap[String(p.Container_ID)]?.action}/></td>
                      </tr>
                    ))}
                    {lookupFiltered.length===0 && (
                      <tr><td colSpan={8} style={{textAlign:"center",padding:"20px",color:"var(--t3)",fontFamily:"var(--mono)",fontSize:10}}>
                        No containers match your filters
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pager total={lookupFiltered.length} page={lookupPage} size={lookupSize} onPage={setLookupPage} onSize={setLookupSize}/>
            </>
          ) : <div className="empty"><div className="empty-hd">Load a batch first</div><div className="empty-bd">Go to My Queue tab and upload a CSV.</div></div>}
        </>
      )}

      {/* ── HISTORY ── */}
      {tab==="history" && (() => {
        const H_FILTERS = [
          ["all","All"],["cleared","Cleared"],["detained","Detained"],["seized","Seized"],["inspected","Inspected"],
        ];
        const hFiltered = myInsps
          .filter(i => {
            const ms = !hSearch || String(i.container_id||"").includes(hSearch) || (i.notes||"").toLowerCase().includes(hSearch.toLowerCase());
            const ma = hAction==="all" || i.action===hAction;
            return ms && ma;
          })
          .slice()
          .sort((a,b) => {
            if(hSort==="newest") return new Date(b.timestamp||0)-new Date(a.timestamp||0);
            if(hSort==="oldest") return new Date(a.timestamp||0)-new Date(b.timestamp||0);
            if(hSort==="action") return (a.action||"").localeCompare(b.action||"");
            if(hSort==="id")     return String(a.container_id||"").localeCompare(String(b.container_id||""));
            return 0;
          });
        const hCounts = {};
        myInsps.forEach(i=>{ hCounts[i.action]=(hCounts[i.action]||0)+1; });

        return myInsps.length > 0 ? (
          <>
            {/* Action filter + search */}
            <div className="flt-row">
              {H_FILTERS.map(([id,lbl])=>(
                <button key={id} className={`flt-btn ${hAction===id?"on":""}`} onClick={()=>setHAction(id)}>
                  {lbl}
                  {id!=="all" && hCounts[id]>0 && <span style={{marginLeft:5,background:"var(--text)",color:"var(--bg)",borderRadius:8,padding:"2px 6px",fontSize:11}}>{hCounts[id]}</span>}
                </button>
              ))}
              <input className="srch" placeholder="Search by container ID or notes..."
                value={hSearch} onChange={e=>setHSearch(e.target.value)}/>
            </div>

            {/* Sort row + count */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--t3)"}}>{hFiltered.length} record{hFiltered.length!==1?"s":""}</span>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontFamily:"var(--display)",fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--t3)"}}>Sort</span>
                {[["newest","Newest"],["oldest","Oldest"],["action","Action"],["id","Container ID"]].map(([v,lbl])=>(
                  <button key={v} className={`flt-btn ${hSort===v?"on":""}`} style={{padding:"4px 10px",fontSize:12}} onClick={()=>setHSort(v)}>{lbl}</button>
                ))}
              </div>
            </div>

            {hFiltered.length > 0 ? (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Container ID</th><th>Action</th><th>Final Status</th><th>Notes</th><th>Time</th></tr></thead>
                  <tbody>
                    {hFiltered.map((i,idx)=>(
                      <tr key={idx}>
                        <td className="mn" style={{fontWeight:600}}>{i.container_id}</td>
                        <td><ActionStatus status={i.action}/></td>
                        <td className="mn" style={{fontSize:10}}>{i.final_status||"—"}</td>
                        <td style={{fontSize:10,color:"var(--t2)",maxWidth:280}}>{i.notes||<span style={{color:"var(--t4)"}}>—</span>}</td>
                        <td className="mn" style={{fontSize:12,color:"var(--t3)",fontFamily:"var(--display)"}}>{i.timestamp?new Date(i.timestamp).toLocaleString():"—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty"><div className="empty-hd">No matches</div><div className="empty-bd">Try adjusting your search or filter.</div></div>
            )}
          </>
        ) : <div className="empty"><div className="empty-hd">No actions recorded yet</div><div className="empty-bd">Your inspection decisions will appear here.</div></div>;
      })()}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   RISK ANALYST DASHBOARD
══════════════════════════════════════════════════════════════ */
function AnalystDashboard({ token }) {
  const [tab,        setTab]       = useState("metrics");
  const [status,     setStatus]    = useState(null);
  const [metrics,    setMetrics]   = useState(null);
  const [feats,      setFeats]     = useState([]);
  const [config,     setConfig]    = useState(null);
  const [origConfig, setOrigConfig]= useState(null);
  const [dirty,      setDirty]     = useState(false);
  const [saving,     setSaving]    = useState(false);
  const [error,      setError]     = useState("");

  // ── Tester state ──────────────────────────────────────────
  const [testFile,      setTestFile]      = useState(null);
  const [testRunning,   setTestRunning]   = useState(false);
  const [testResult,    setTestResult]    = useState(null);
  const [testError,     setTestError]     = useState("");
  const [testFilter,    setTestFilter]    = useState("");
  const [testAnomaly,   setTestAnomaly]   = useState("");
  const [testSearch,    setTestSearch]    = useState("");
  const [testPage,      setTestPage]      = useState(0);
  const [testPageSize,  setTestPageSize]  = useState(50);
  const [testSortCol,   setTestSortCol]   = useState("Risk_Score");
  const [testSortDir,   setTestSortDir]   = useState(-1);
  const [testDetail,    setTestDetail]    = useState(null);
  const testFileRef = useRef();

  const handleTestFile = (file) => {
    if (!file || !file.name.endsWith(".csv")) return;
    setTestFile(file); setTestResult(null); setTestError("");
  };

  const runTest = async () => {
    if (!testFile) return;
    setTestRunning(true); setTestError(""); setTestResult(null);
    try {
      const fd = new FormData();
      fd.append("file", testFile);
      const res = await fetch(`${API}/predict`, {
        method: "POST", body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(60000),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "Prediction failed");
      setTestResult(d);
      setTestPage(0);
    } catch(e) { setTestError(e.message); }
    setTestRunning(false);
  };

  const testRows = testResult?.predictions || [];
  const testFiltered = testRows.filter(r => {
    if (testFilter && r.Risk_Level !== testFilter) return false;
    if (testAnomaly !== "" && String(r.Anomaly_Flag) !== testAnomaly) return false;
    if (testSearch) {
      const h = JSON.stringify(r).toLowerCase();
      if (!h.includes(testSearch.toLowerCase())) return false;
    }
    return true;
  }).sort((a, b) => {
    let av = a[testSortCol], bv = b[testSortCol];
    if (!isNaN(parseFloat(av))) { av = parseFloat(av); bv = parseFloat(bv); }
    if (av < bv) return testSortDir; if (av > bv) return -testSortDir; return 0;
  });

  const testSorted = (col) => {
    if (testSortCol === col) setTestSortDir(d => -d);
    else { setTestSortCol(col); setTestSortDir(-1); }
    setTestPage(0);
  };

  const testPageRows = testFiltered.slice(testPage * testPageSize, (testPage + 1) * testPageSize);
  const testPages    = Math.ceil(testFiltered.length / testPageSize);

  const exportTest = () => {
    if (!testFiltered.length) return;
    const keys = Object.keys(testFiltered[0]);
    const csv  = [keys.join(","), ...testFiltered.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"}));
    a.download = `smartrisk_test_${testFile?.name || "results"}`; a.click();
  };
  // Feature importance filter/sort
  const [featSearch, setFeatSearch]= useState("");
  const [featSort,   setFeatSort]  = useState("importance-desc");

  useEffect(()=>{
    const poll=async()=>{
      try {
        const s=await api("/status",{},token); setStatus(s);
        if(s.model_trained){
          if(!metrics){
            const m=await api("/metrics",{},token); setMetrics(m);
            const fi=await api("/feature-importance",{},token); setFeats(fi);
          }
          if(!config){
            const c=await api("/model-config",{},token);
            setConfig(c); setOrigConfig(JSON.parse(JSON.stringify(c)));
          }
        }
      } catch{}
    };
    poll(); const t=setInterval(poll,3000); return()=>clearInterval(t);
  },[token,metrics,config]);

  const trainSt    = status?.train_status;
  const isTraining = trainSt?.state==="training"||trainSt?.state==="retraining";
  const isReady    = status?.model_trained;
  const maxFeat    = feats[0]?.importance||1;

  // Which config keys require retraining
  const RETRAIN_KEYS = new Set(["n_estimators","max_depth","learning_rate","val_split"]);
  const changedKeys  = origConfig ? Object.keys(config||{}).filter(k=>config[k]!==origConfig[k]) : [];
  const willRetrain  = changedKeys.some(k=>RETRAIN_KEYS.has(k));

  // Refresh metrics + feature importance from server
  const refreshMetrics = async () => {
    try {
      const m  = await api("/metrics",          {}, token); setMetrics(m);
      const fi = await api("/feature-importance",{}, token); setFeats(fi);
    } catch {}
  };

  // Re-run tester with the currently loaded file (picks up new threshold/model)
  const rerunTester = async () => {
    if (!testFile) return;
    setTestRunning(true); setTestError("");
    try {
      const fd = new FormData(); fd.append("file", testFile);
      const res = await fetch(`${API}/predict`, {
        method:"POST", body:fd,
        headers: token ? { Authorization:`Bearer ${token}` } : {},
        signal: AbortSignal.timeout(60000),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "Prediction failed");
      setTestResult(d); setTestPage(0);
    } catch(e) { setTestError(e.message); }
    setTestRunning(false);
  };

  const saveConfig = async () => {
    if (!config) return; setSaving(true); setError("");
    try {
      const res = await api("/model-config", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(config),
      }, token);
      setOrigConfig(JSON.parse(JSON.stringify(config))); setDirty(false);
      if (res.retraining) {
        // Full retrain — metrics will update once training completes (poll picks it up)
        setMetrics(null); setFeats([]);
        setTestResult(null); // tester results are stale, clear them
      } else {
        // Threshold-only change — immediately refresh metrics and rerun tester
        await refreshMetrics();
        await rerunTester();
      }
    } catch(e) { setError(e.message); }
    setSaving(false);
  };

  const retrain = async () => {
    try {
      await api("/retrain", {method:"POST"}, token);
      setMetrics(null); setFeats([]);
      setTestResult(null); // stale after retrain
    } catch(e) { setError(e.message); }
  };

  const resetConfig = async () => {
    try {
      const c = await api("/model-config", {}, token);
      setConfig(c); setOrigConfig(JSON.parse(JSON.stringify(c))); setDirty(false);
      // Refresh metrics and tester to reflect the reset config
      await refreshMetrics();
      await rerunTester();
    } catch(e) { setError(e.message); }
  };

  const updateConfig = (key, val) => {
    setConfig(prev => ({...prev, [key]: val})); setDirty(true);
  };

  // Feature importance display — filtered + sorted
  const filteredFeats = feats
    .filter(f=>!featSearch||f.feature.toLowerCase().includes(featSearch.toLowerCase()))
    .slice()
    .sort((a,b)=>{
      if(featSort==="importance-desc") return b.importance-a.importance;
      if(featSort==="importance-asc")  return a.importance-b.importance;
      if(featSort==="name")            return a.feature.localeCompare(b.feature);
      return 0;
    });

  return (
    <div>
      <div className="stabs">
        {[["metrics","Model Metrics"],["tester","CSV Tester"],["training","Training Controls"]].map(([id,lbl])=>(
          <div key={id} className={`stab ${tab===id?"on":""}`} onClick={()=>setTab(id)}>{lbl}</div>
        ))}
      </div>

      {/* ══ CSV TESTER ══ */}
      {tab==="tester" && (
        <div>
          {/* Active config banner */}
          {config && (
            <div style={{background:"var(--bg)",border:"1px solid var(--border)",borderLeft:"3px solid var(--text)",padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:18,flexWrap:"wrap",fontFamily:"var(--display)",fontSize:12,fontWeight:500,color:"var(--t3)"}}>
              <span style={{letterSpacing:"0.07em",textTransform:"uppercase",fontWeight:700,color:"var(--t2)"}}>Active Config</span>
              {[["Crit. Threshold",((config.risk_threshold_critical||0)*100).toFixed(0)+"%"],["Low Threshold",((config.risk_threshold_low||0)*100).toFixed(0)+"%"],["Trees",config.n_estimators],["Depth",config.max_depth],["LR",config.learning_rate?.toFixed(2)]].map(([k,v])=>(
                <span key={k}>{k} <span style={{color:"var(--text)",fontWeight:700}}>{v}</span></span>
              ))}
              {dirty && <span style={{color:"#BB6600",marginLeft:"auto"}}>⚠ Unsaved changes — save in Training Controls to apply</span>}
            </div>
          )}
          {/* Upload row */}
          <div className="panel" style={{marginBottom:12}}>
            <div className="ph">Upload Test CSV</div>
            <div style={{display:"flex",gap:10,alignItems:"stretch",flexWrap:"wrap"}}>
              <div className="dropzone" style={{flex:1,minWidth:220}}
                onClick={()=>testFileRef.current.click()}
                onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add("drag")}}
                onDragLeave={e=>e.currentTarget.classList.remove("drag")}
                onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove("drag");handleTestFile(e.dataTransfer.files[0]);}}>
                <input ref={testFileRef} type="file" accept=".csv" style={{display:"none"}}
                  onChange={e=>handleTestFile(e.target.files[0])}/>
                <UploadIcon/>
                <div>
                  <div className="drop-name">{testFile ? testFile.name : "Click or drop a CSV"}</div>
                  <div className="drop-hint">
                    {testFile
                      ? `${(testFile.size/1024).toFixed(1)} KB · Ready`
                      : "Required: Container_ID, Declared_Weight, Measured_Weight, Declared_Value, Dwell_Time_Hours · Optional: Clearance_Status (enables accuracy report)"}
                  </div>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
                <button className="btn btn-dark" disabled={!testFile||testRunning} onClick={runTest}>
                  {testRunning ? <><SpinIcon/>Running...</> : "▶ Run Assessment"}
                </button>
                {testResult && (
                  <button className="btn btn-ghost" disabled={testRunning} onClick={rerunTester} title="Re-score with current threshold/model settings">
                    {testRunning ? <><SpinIcon/>Re-running...</> : "↻ Rerun"}
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={()=>{
                  const csv=`Container_ID,Declared_Weight,Measured_Weight,Declared_Value,Dwell_Time_Hours,Origin_Country,Destination_Country,Destination_Port,HS_Code,Importer_ID,Exporter_ID,Shipping_Line,Trade_Regime (Import / Export / Transit),Declaration_Date,Clearance_Status\nCONT001,5000,5100,15000,48,China,USA,Los Angeles,850420,IMP001,EXP001,Maersk,Import,2024-01-15 09:30:00,Clear\nCONT002,3000,4200,8500,96,Iran,UK,Felixstowe,730110,IMP002,EXP002,MSC,Import,2024-01-15 23:15:00,Critical\nCONT003,8000,8050,22000,36,Germany,France,Le Havre,870322,IMP003,EXP003,CMA CGM,Import,2024-01-16 14:00:00,Low Risk\nCONT004,2500,3900,500,120,North Korea,Australia,Sydney,711319,IMP004,EXP004,COSCO,Import,2024-01-16 02:45:00,Critical\nCONT005,6000,6020,45000,24,Japan,Canada,Vancouver,847130,IMP005,EXP005,Evergreen,Import,2024-01-17 10:00:00,Clear`;
                  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="sample_containers.csv";a.click();
                }}>⬇ Sample CSV</button>
              </div>
            </div>
            {testError && <div className="err-bar" style={{marginTop:10,marginBottom:0}}>⚠ {testError}</div>}
          </div>

          {testResult && (
            <>
              {/* Summary KPIs */}
              {(() => {
                const s = testResult.summary || {};
                const rows = testResult.predictions || [];
                const anomCount = rows.filter(r=>r.Anomaly_Flag==1||r.Anomaly_Flag=="1").length;
                return (
                  <div className="kpi-row" style={{gridTemplateColumns:"repeat(6,1fr)",marginBottom:12}}>
                    {[
                      ["TOTAL", (s.total||rows.length).toLocaleString(), ""],
                      ["CRITICAL", (s.critical_count||0).toLocaleString(), "r"],
                      ["LOW RISK", (s.low_risk_count||0).toLocaleString(), ""],
                      ["CLEAR", (s.clear_count||0).toLocaleString(), "g"],
                      ["ANOMALIES", anomCount.toLocaleString(), "r"],
                      ["AVG SCORE", (s.avg_risk_score||0).toFixed(1), ""],
                    ].map(([lbl,val,cls])=>(
                      <div key={lbl} className="kpi">
                        <div className={`kpi-n ${cls}`}>{val}</div>
                        <div className="kpi-l">{lbl}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Accuracy report (only if Clearance_Status was in CSV) */}
              {testResult.accuracy_report?.available && (() => {
                const ar = testResult.accuracy_report;
                const pc = ar.per_class;
                const cm = ar.confusion_matrix;
                const cls= ar.classes;
                const mf1= pc["macro avg"]?.["f1-score"];
                const p = v => v!=null?(v*100).toFixed(1)+"%":"—";
                return (
                  <div className="panel" style={{marginBottom:12,borderLeft:"3px solid var(--green)"}}>
                    <div className="ph" style={{color:"var(--green)"}}>✓ Accuracy Report — Ground Truth Labels Detected</div>
                    <div className="g3" style={{marginBottom:16}}>
                      {["Critical","Low Risk","Clear"].map(c=>{
                        const s=pc[c]||{};
                        const isWarn = c==="Critical" && (s.recall||0)<0.85;
                        return (
                          <div key={c} style={{background:"var(--bg1)",padding:"14px 16px",border:`1px solid ${isWarn?"var(--red)":"var(--border)"}`,borderRadius:"var(--radius)"}}>
                            <div style={{marginBottom:10}}><RiskBadge level={c}/></div>
                            {[["Precision",s.precision],["Recall",s.recall],["F1",s["f1-score"]]].map(([k,v])=>(
                              <div key={k} style={{display:"flex",justifyContent:"space-between",fontFamily:"var(--display)",fontSize:13,marginBottom:6}}>
                                <span style={{color:"var(--t3)",fontWeight:500}}>{k}</span>
                                <span style={{color: k==="Recall"&&c==="Critical"&&(v||0)<0.85?"var(--red)":"var(--text)",fontWeight:700}}>{p(v)}</span>
                              </div>
                            ))}
                            <div style={{fontFamily:"var(--display)",fontSize:12,fontWeight:500,color:"var(--t3)",marginTop:6}}>n={s.support?.toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{fontFamily:"var(--display)",fontSize:13,fontWeight:500,color:"var(--t3)",marginBottom:12,display:"flex",gap:20,alignItems:"baseline"}}>
                      <span>Macro F1 <span style={{color:"var(--text)",fontWeight:700,fontSize:18,fontFamily:"var(--display)"}}>{p(mf1)}</span></span>
                      <span>Weighted F1 <span style={{color:"var(--text)",fontWeight:700,fontSize:18,fontFamily:"var(--display)"}}>{p(pc["weighted avg"]?.["f1-score"])}</span></span>
                    </div>
                    {cm && cls && (
                      <div style={{overflowX:"auto",marginTop:8}}>
                        <table style={{fontFamily:"var(--display)",fontSize:13,borderCollapse:"collapse",width:"100%"}}>
                          <thead>
                            <tr>
                              <th style={{padding:"8px 12px",color:"var(--t3)",textAlign:"left",borderBottom:"2px solid var(--border)",fontWeight:600,fontSize:12}}>Actual ↓ / Pred →</th>
                              {cls.map(c=><th key={c} style={{padding:"8px 12px",color:"var(--t2)",textAlign:"center",borderBottom:"2px solid var(--border)",fontWeight:700,fontSize:13}}>{c}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {cm.map((row,i)=>(
                              <tr key={i}>
                                <td style={{padding:"8px 12px",color:"var(--t2)",fontWeight:700,borderRight:"1px solid var(--border)",fontSize:13}}>{cls[i]}</td>
                                {row.map((v,j)=>(
                                  <td key={j} style={{padding:"8px 12px",textAlign:"center",
                                    background: i===j?"rgba(26,122,58,0.12)":v>0?"rgba(204,34,0,0.06)":"",
                                    color: i===j?"var(--green)":v>0?"var(--red)":"var(--t4)",
                                    fontWeight: i===j?700:v>0?600:400,
                                    fontSize:13
                                  }}>{v}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Predictions table */}
              <div className="panel" style={{padding:0}}>
                <div style={{padding:"14px 18px",borderBottom:"1px solid var(--border)"}}>
                  <div className="ph" style={{marginBottom:10}}>Predictions · {testFiltered.length.toLocaleString()} of {testRows.length.toLocaleString()} shown</div>
                  <div className="flt-row" style={{marginBottom:0}}>
                    {["","Critical","Low Risk","Clear"].map(v=>(
                      <button key={v} className={`flt-btn ${testFilter===v?"on":""}`} onClick={()=>{setTestFilter(v);setTestPage(0);}}>
                        {v||"All"}
                      </button>
                    ))}
                    <button className={`flt-btn ${testAnomaly==="1"?"on":""}`} onClick={()=>{setTestAnomaly(a=>a==="1"?"":"1");setTestPage(0);}}>
                      ⚠ Anomaly
                    </button>
                    <input className="srch" placeholder="Search container, country, HS code…"
                      value={testSearch} onChange={e=>{setTestSearch(e.target.value);setTestPage(0);}}/>
                    <button className="btn btn-ghost btn-sm" onClick={exportTest}><DlIcon/> Export</button>
                  </div>
                </div>

                <div className="tbl-wrap" style={{border:"none",borderRadius:0}}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        {[
                          ["Container_ID","Container"],["Risk_Level","Risk"],["Risk_Score","Score"],
                          ["Anomaly_Flag","Anomaly"],["Origin_Country","Origin"],["Importer_ID","Importer"],
                          ["HS_Code","HS Code"],["Declared_Weight","Decl. Wt"],["Measured_Weight","Meas. Wt"],
                          ["Dwell_Time_Hours","Dwell (h)"],["Declared_Value","Value"],
                        ].filter(([k])=>testRows.some(r=>r[k]!=null)).map(([k,lbl])=>(
                          <th key={k} onClick={()=>testSorted(k)} style={{cursor:"pointer",userSelect:"none"}}>
                            {lbl}{testSortCol===k?(testSortDir===-1?" ↓":" ↑"):""}
                          </th>
                        ))}
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {testPageRows.map((r,i)=>{
                        const score=parseFloat(r.Risk_Score)||0;
                        const isAnomaly=r.Anomaly_Flag==1||r.Anomaly_Flag=="1";
                        return (
                          <tr key={i} className={r.Risk_Level==="Critical"?"hi":""}>
                            <td className="mn">{r.Container_ID}</td>
                            <td><RiskBadge level={r.Risk_Level}/></td>
                            <td><ScoreBar score={Math.round(score)}/></td>
                            <td>{isAnomaly?<span className="badge berr">⚠ FLAG</span>:<span style={{color:"var(--t4)"}}>—</span>}</td>
                            {["Origin_Country","Importer_ID","HS_Code"].map(k=>
                              testRows.some(rr=>rr[k]!=null) ? <td key={k} className="mn" style={{color:"var(--t2)"}}>{r[k]||"—"}</td> : null
                            )}
                            {[["Declared_Weight","kg"],["Measured_Weight","kg"],["Dwell_Time_Hours","h"]].map(([k,u])=>
                              testRows.some(rr=>rr[k]!=null) ? <td key={k} className="mn">{r[k]!=null?`${Number(r[k]).toLocaleString()} ${u}`:"—"}</td> : null
                            )}
                            {testRows.some(rr=>rr.Declared_Value!=null)?<td className="mn">{r.Declared_Value!=null?"$"+Number(r.Declared_Value).toLocaleString():"—"}</td>:null}
                            <td>
                              <button className="btn btn-ghost btn-sm" onClick={()=>setTestDetail(r)}>Detail</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{padding:"0 18px"}}>
                  <Pager total={testFiltered.length} page={testPage} size={testPageSize}
                    onPage={setTestPage} onSize={setTestPageSize}/>
                </div>
              </div>
            </>
          )}

          {/* Detail drawer */}
          {testDetail && (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:300,display:"flex",justifyContent:"flex-end"}}
              onClick={e=>{if(e.target===e.currentTarget)setTestDetail(null);}}>
              <div style={{background:"var(--bg)",width:400,height:"100vh",overflowY:"auto",padding:24,borderLeft:"1px solid var(--border)",animation:"fadeUp .2s ease"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div>
                    <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--t3)",marginBottom:4}}>Container</div>
                    <div style={{fontFamily:"var(--mono)",fontSize:16,fontWeight:700}}>{testDetail.Container_ID}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setTestDetail(null)}>✕ Close</button>
                </div>

                <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:18,flexWrap:"wrap"}}>
                  <RiskBadge level={testDetail.Risk_Level}/>
                  <span style={{fontFamily:"var(--mono)",fontSize:22,fontWeight:800}}>{Math.round(parseFloat(testDetail.Risk_Score)||0)}</span>
                  <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--t3)"}}>/100</span>
                  {(testDetail.Anomaly_Flag==1||testDetail.Anomaly_Flag=="1")&&<span className="badge berr">⚠ ANOMALY</span>}
                </div>

                {/* Details grid */}
                {[
                  ["Origin Country",     testDetail.Origin_Country],
                  ["Destination",        testDetail.Destination_Country],
                  ["Destination Port",   testDetail.Destination_Port],
                  ["Importer ID",        testDetail.Importer_ID],
                  ["Exporter ID",        testDetail.Exporter_ID],
                  ["HS Code",            testDetail.HS_Code],
                  ["Shipping Line",      testDetail.Shipping_Line],
                  ["Trade Regime",       testDetail["Trade_Regime (Import / Export / Transit)"]||testDetail.Trade_Regime],
                  ["Declared Weight",    testDetail.Declared_Weight!=null?`${Number(testDetail.Declared_Weight).toLocaleString()} kg`:null],
                  ["Measured Weight",    testDetail.Measured_Weight!=null?`${Number(testDetail.Measured_Weight).toLocaleString()} kg`:null],
                  ["Weight Discrepancy", testDetail.Declared_Weight&&testDetail.Measured_Weight
                    ?`${(Math.abs(testDetail.Declared_Weight-testDetail.Measured_Weight)/Math.max(testDetail.Declared_Weight,1)*100).toFixed(1)}%`:null],
                  ["Declared Value",     testDetail.Declared_Value!=null?`$${Number(testDetail.Declared_Value).toLocaleString()}`:null],
                  ["Dwell Time",         testDetail.Dwell_Time_Hours!=null?`${Number(testDetail.Dwell_Time_Hours).toFixed(0)} hours`:null],
                ].filter(([,v])=>v!=null&&v!=="undefined").map(([k,v])=>(
                  <div key={k} className="det-grid" style={{gridTemplateColumns:"1fr 1fr",gap:1,marginBottom:1}}>
                    <div className="dc"><div className="dc-k">{k}</div></div>
                    <div className="dc"><div className="dc-v" style={{fontSize:11}}>{v}</div></div>
                  </div>
                ))}

                {/* Risk factors */}
                {testDetail.Explanation && (
                  <div style={{marginTop:16}}>
                    <div style={{fontFamily:"var(--display)",fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",color:"var(--t3)",marginBottom:8}}>Risk Factors</div>
                    {String(testDetail.Explanation).split(";").filter(Boolean).map((e,i)=>(
                      <div key={i} className="expl" style={{marginBottom:6}}>▸ {e.trim()}</div>
                    ))}
                  </div>
                )}

                {/* Model probabilities */}
                {Object.entries(testDetail).filter(([k])=>k.startsWith("Prob_")).length>0 && (
                  <div style={{marginTop:16}}>
                    <div style={{fontFamily:"var(--display)",fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",color:"var(--t3)",marginBottom:8}}>Model Probabilities</div>
                    {Object.entries(testDetail).filter(([k])=>k.startsWith("Prob_")).map(([k,v])=>(
                      <div key={k} className="fb">
                        <div className="fb-h">
                          <span className="fb-n">{k.replace("Prob_","P(")+")"}</span>
                          <span className="fb-p">{(parseFloat(v)*100).toFixed(1)}%</span>
                        </div>
                        <div className="fb-bg"><div className="fb-fl" style={{width:`${parseFloat(v)*100}%`}}/></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {isTraining && (
        <div className="train-bar"><SpinIcon/>
          <div style={{flex:1}}>
            <div className="train-msg">{trainSt.message}</div>
            <div className="train-track"><div className="train-fill" style={{width:`${trainSt.progress}%`}}/></div>
          </div>
        </div>
      )}
      {error && <div className="err-bar">⚠ {error}</div>}

      {/* ══ MODEL METRICS ══ */}
      {tab==="metrics" && (
        metrics ? (
          <>
          {/* Active config banner — shows what settings produced these metrics */}
          {config && (
            <div style={{background:"var(--bg)",border:"1px solid var(--border)",borderLeft:"3px solid var(--text)",padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:18,flexWrap:"wrap",fontFamily:"var(--display)",fontSize:12,fontWeight:500,color:"var(--t3)"}}>
              <span style={{letterSpacing:"0.07em",textTransform:"uppercase",fontWeight:700,color:"var(--t2)"}}>Active Config</span>
              {[["Crit. Threshold",((config.risk_threshold_critical||0)*100).toFixed(0)+"%"],["Low Threshold",((config.risk_threshold_low||0)*100).toFixed(0)+"%"],["Trees",config.n_estimators],["Depth",config.max_depth],["LR",config.learning_rate?.toFixed(2)]].map(([k,v])=>(
                <span key={k}>{k} <span style={{color:"var(--text)",fontWeight:700}}>{v}</span></span>
              ))}
              {dirty && <span style={{color:"#BB6600",marginLeft:"auto"}}>⚠ Unsaved changes in Training Controls</span>}
              <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto"}} onClick={refreshMetrics}>↻ Refresh</button>
            </div>
          )}
          <div className="g2">
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div className="panel">
                <div className="ph">Validation Metrics · 20% Holdout</div>

                <div style={{fontFamily:"var(--display)",fontSize:11,fontWeight:600,color:"var(--t2)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Primary Metric</div>
                <div className="met-grid" style={{gridTemplateColumns:"1fr",marginBottom:14}}>
                  <div className="met-cell hi" style={{background:"#0D2B1A"}}>
                    <div className="met-val" style={{fontSize:34,color:"var(--green)"}}>{(metrics.macro_f1*100).toFixed(2)}%</div>
                    <div className="met-lbl" style={{fontSize:12,marginTop:8}}>Macro F1 — All Three Classes Weighted Equally</div>
                  </div>
                </div>

                <div style={{fontFamily:"var(--display)",fontSize:11,fontWeight:600,color:"var(--t2)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Secondary Metrics</div>
                <div className="met-grid" style={{gridTemplateColumns:"1fr 1fr",marginBottom:14}}>
                  <div className="met-cell hi"><div className="met-val">{((metrics.f1_critical||metrics.critical_f1||0)*100).toFixed(1)}%</div><div className="met-lbl">F1 — Critical</div></div>
                  <div className="met-cell hi"><div className="met-val">{(metrics.recall_critical*100).toFixed(1)}%</div><div className="met-lbl">Recall — Critical</div></div>
                </div>
                <div className="met-grid" style={{gridTemplateColumns:"1fr 1fr 1fr",marginBottom:14}}>
                  <div className="met-cell"><div className="met-val">{(metrics.weighted_f1*100).toFixed(1)}%</div><div className="met-lbl">Weighted F1</div></div>
                  <div className="met-cell"><div className="met-val">{(metrics.precision_critical*100).toFixed(1)}%</div><div className="met-lbl">Critical Precision</div></div>
                  <div className="met-cell"><div className="met-val">{(metrics.auc*100).toFixed(1)}%</div><div className="met-lbl">AUC (OvR)</div></div>
                </div>

                {metrics.confusion_matrix && metrics.classes && (
                  <div style={{marginBottom:14}}>
                    <div style={{fontFamily:"var(--display)",fontSize:11,fontWeight:600,color:"var(--t2)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.07em"}}>Confusion Matrix</div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{fontFamily:"var(--display)",fontSize:12,borderCollapse:"collapse",width:"100%"}}>
                        <thead>
                          <tr>
                            <th style={{padding:"8px 12px",color:"var(--t3)",textAlign:"left",borderBottom:"2px solid var(--border)",fontWeight:600,fontSize:11}}>Actual ↓ / Pred →</th>
                            {metrics.classes.map(c=>(
                              <th key={c} style={{padding:"8px 12px",color:"var(--t2)",textAlign:"center",borderBottom:"2px solid var(--border)",fontWeight:700,fontSize:12}}>{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.confusion_matrix.map((row,i)=>{
                            const rowSum=row.reduce((a,b)=>a+b,0);
                            return (
                              <tr key={i}>
                                <td style={{padding:"8px 12px",color:"var(--t2)",fontWeight:700,borderBottom:"1px solid var(--border)",fontSize:13}}>{metrics.classes[i]}</td>
                                {row.map((val,j)=>{
                                  const isCorrect=i===j;
                                  const pct=rowSum>0?Math.round(val/rowSum*100):0;
                                  return (
                                    <td key={j} style={{padding:"8px 12px",textAlign:"center",borderBottom:"1px solid var(--border)",
                                      background:isCorrect?"rgba(0,200,100,0.12)":val>0?"rgba(255,80,80,0.08)":"transparent",
                                      color:isCorrect?"var(--green)":val>0?"#CC4444":"var(--t4)",fontWeight:isCorrect?700:400}}>
                                      {val}<span style={{fontSize:10,opacity:0.7,marginLeft:4}}>({pct}%)</span>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="met-grid" style={{gridTemplateColumns:"1fr 1fr"}}>
                  <div className="met-cell"><div className="met-val">{metrics.val_size?.toLocaleString()}</div><div className="met-lbl">Validation Rows</div></div>
                  <div className="met-cell"><div className="met-val">{metrics.best_crit_threshold?.toFixed(2)??"—"}</div><div className="met-lbl">Tuned Crit. Threshold</div></div>
                </div>
              </div>
              <div className="panel">
                <div className="ph">Per-Class Performance</div>
                {["Critical","Low Risk","Clear"].map(cls=>{
                  const c=metrics.per_class?.[cls]; if(!c) return null;
                  return (
                    <div key={cls} style={{marginBottom:20}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <RiskBadge level={cls}/>
                        <span style={{fontFamily:"var(--display)",fontSize:12,fontWeight:500,color:"var(--t3)"}}>n={c.support?.toLocaleString()}</span>
                      </div>
                      {[["Precision",c.precision],["Recall",c.recall],["F1",c["f1-score"]]].map(([k,v])=>(
                        <div key={k} className="fb"><div className="fb-h"><span className="fb-n">{k}</span><span className="fb-p">{(v*100).toFixed(1)}%</span></div><div className="fb-bg"><div className="fb-fl" style={{width:`${v*100}%`}}/></div></div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Feature Importance with search + sort */}
            <div className="panel">
              <div className="ph">Feature Importance</div>
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                <input className="srch" style={{flex:1,minWidth:120,fontSize:10,padding:"5px 10px"}}
                  placeholder="Filter features..."
                  value={featSearch} onChange={e=>setFeatSearch(e.target.value)}/>
                {[["importance-desc","Weight ↓"],["importance-asc","Weight ↑"],["name","A–Z"]].map(([v,lbl])=>(
                  <button key={v} className={`flt-btn ${featSort===v?"on":""}`} style={{padding:"4px 8px",fontSize:8}} onClick={()=>setFeatSort(v)}>{lbl}</button>
                ))}
              </div>
              <div style={{fontFamily:"var(--display)",fontSize:12,color:"var(--t3)",marginBottom:10}}>
                {filteredFeats.length} of {feats.length} features
              </div>
              {filteredFeats.map(f=>(
                <div key={f.feature} className="fb">
                  <div className="fb-h"><span className="fb-n">{f.feature}</span><span className="fb-p">{(f.importance*100).toFixed(1)}%</span></div>
                  <div className="fb-bg"><div className="fb-fl" style={{width:`${(f.importance/maxFeat)*100}%`}}/></div>
                </div>
              ))}
              {filteredFeats.length===0 && <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--t4)",padding:"12px 0"}}>No features match "{featSearch}"</div>}
            </div>
          </div>
          </>
        ) : (
          <div className="empty">
            <div className="empty-hd">{isTraining?"Training in progress...":"Model not trained"}</div>
            <div className="empty-bd">Metrics will appear here after training completes.</div>
          </div>
        )
      )}

      {/* ══ TRAINING CONTROLS ══ */}
      {tab==="training" && (
        config ? (
          <>
            {/* Change summary banner */}
            {dirty && (
              <div style={{background: willRetrain?"#FFF8EE":"#F0FFF4", border:`1px solid ${willRetrain?"#FFCC80":"#C6F6D5"}`, borderLeft:`3px solid ${willRetrain?"#BB6600":"var(--green)"}`, padding:"10px 16px", fontFamily:"var(--mono)", fontSize:10, color: willRetrain?"#BB6600":"var(--green)", marginBottom:14, display:"flex", gap:12, alignItems:"center"}}>
                {willRetrain ? "⚠ Hyperparameter changes detected — saving will trigger automatic retraining." : "✓ Threshold-only changes — saving applies immediately without retraining."}
                <span style={{marginLeft:"auto",color:"var(--t3)"}}>Changed: {changedKeys.join(", ")}</span>
              </div>
            )}

            <div className="g2">
              <div className="panel">
                <div className="ph">Model Hyperparameters <span style={{color:"var(--red)",marginLeft:4}}>· triggers retraining on save</span></div>
                <div style={{fontSize:10,color:"var(--t3)",marginBottom:18,lineHeight:1.7}}>Changing these values will trigger automatic retraining on save.</div>
                {[
                  ["Estimators (Trees)","n_estimators",100,1000,50],
                  ["Max Depth","max_depth",3,10,1],
                  ["Learning Rate","learning_rate",0.01,0.3,0.01],
                  ["Validation Split","val_split",0.1,0.4,0.05],
                ].map(([lbl,key,mn,mx,st])=>{
                  const changed = origConfig && config[key]!==origConfig[key];
                  const display = key==="learning_rate"?config[key].toFixed(2):key==="val_split"?`${(config[key]*100).toFixed(0)}%`:config[key];
                  const origDisplay = origConfig?(key==="learning_rate"?origConfig[key].toFixed(2):key==="val_split"?`${(origConfig[key]*100).toFixed(0)}%`:origConfig[key]):null;
                  return (
                    <div key={key} className="sld-row">
                      <div className="sld-hd">
                        <span className="sld-l" style={{color:changed?"#BB6600":""}}>{lbl}{changed?" ✎":""}</span>
                        <span className="sld-v">
                          {changed && <span style={{color:"var(--t3)",fontWeight:400,marginRight:6,textDecoration:"line-through"}}>{origDisplay}</span>}
                          <span style={{color:changed?"#BB6600":""}}>{display}</span>
                        </span>
                      </div>
                      <input type="range" className="cfg-slider" min={mn} max={mx} step={st} value={config[key]}
                        onChange={e=>updateConfig(key,+parseFloat(e.target.value).toFixed(4))}/>
                    </div>
                  );
                })}
              </div>

              <div className="panel">
                <div className="ph">Risk Thresholds <span style={{color:"var(--green)",marginLeft:4}}>· applies without retraining</span></div>
                <div style={{fontSize:10,color:"var(--t3)",marginBottom:18,lineHeight:1.7}}>Adjust sensitivity without retraining. Lower thresholds flag more containers.</div>
                {[
                  ["Critical Threshold — P(Critical)","risk_threshold_critical",0.1,0.9,0.05],
                  ["Low Risk Threshold — P(not-clear)","risk_threshold_low",0.05,0.4,0.05],
                ].map(([lbl,key,mn,mx,st])=>{
                  const changed = origConfig && config[key]!==origConfig[key];
                  return (
                    <div key={key} className="sld-row">
                      <div className="sld-hd">
                        <span className="sld-l" style={{color:changed?"var(--green)":""}}>{lbl}{changed?" ✎":""}</span>
                        <span className="sld-v">
                          {changed && <span style={{color:"var(--t3)",fontWeight:400,marginRight:6,textDecoration:"line-through"}}>{(origConfig[key]*100).toFixed(0)}%</span>}
                          <span style={{color:changed?"var(--green)":""}}>{(config[key]*100).toFixed(0)}%</span>
                        </span>
                      </div>
                      <input type="range" className="cfg-slider" min={mn} max={mx} step={st} value={config[key]||0}
                        onChange={e=>updateConfig(key,+parseFloat(e.target.value).toFixed(2))}/>
                    </div>
                  );
                })}

                <div style={{marginTop:24,display:"flex",gap:10}}>
                  <button className="btn btn-dark" style={{flex:1}} disabled={!dirty||saving} onClick={saveConfig}>
                    {saving?<><SpinIcon/>Saving...</>: willRetrain?"Save & Retrain":"Save Config"}
                  </button>
                  <button className="btn btn-ghost" onClick={retrain}>↻ Retrain Now</button>
                  <button className="btn btn-ghost" onClick={resetConfig} disabled={!dirty}>Reset</button>
                </div>
              </div>
            </div>
          </>
        ) : <div className="empty"><div className="empty-hd">{isTraining?"Training...":"Loading config"}</div></div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROOT APP
══════════════════════════════════════════════════════════════ */
export default function App() {
  const [user,  setUser]  = useState(null);
  const [token, setToken] = useState(null);
  const [status,setStatus]= useState(null);

  // Poll model status for header pill
  useEffect(()=>{
    if(!token) return;
    const poll=async()=>{try{setStatus(await api("/status",{},token));}catch{}};
    poll(); const t=setInterval(poll,4000); return()=>clearInterval(t);
  },[token]);

  const handleLogin = (u, t) => { setUser(u); setToken(t); };
  const handleLogout= () => {
    if(token) api("/auth/logout",{method:"POST"},token).catch(()=>{});
    setUser(null); setToken(null); setStatus(null);
  };

  const trainSt   = status?.train_status;
  const isTraining= trainSt?.state==="training"||trainSt?.state==="retraining";
  const isReady   = status?.model_trained;

  const statusPill = isTraining
    ? <div className="pill warn"><div className="s-dot pulse"/>Training</div>
    : isReady ? <div className="pill dark"><div className="s-dot"/>Model Ready</div>
    : token ? <div className="pill"><div className="s-dot"/>Connecting...</div>
    : null;

  return (
    <div className="app">
      <style>{css}</style>
      {!user ? (
        <LoginScreen onLogin={handleLogin}/>
      ) : (
        <>
          <Header user={user} token={token} onLogout={handleLogout} statusPill={statusPill}/>
          <div className="layout">
            <div className="content">
              {user.role==="supervisor"      && <SupervisorDashboard token={token}/>}
              {user.role==="customs_officer" && <OfficerDashboard user={user} token={token}/>}
              {user.role==="risk_analyst"    && <AnalystDashboard token={token}/>}
            </div>
            <footer className="footer">
              <span className="footer-slogan">Guess Less, Sniff More.</span>
            </footer>
          </div>
        </>
      )}
    </div>
  );
}