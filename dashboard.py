"""
퍼포먼스 마케팅 대시보드
실행: streamlit run dashboard.py
데이터: data/raw/channel/*_channel.csv + data/raw/appsflyer/*_appsflyer.csv
      → 새 파일을 raw 폴더에 넣고 브라우저 새로고침하면 자동 반영
      → master 파일은 캐시로만 사용 (raw가 더 최신이면 자동 재빌드)
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from pathlib import Path
import numpy as np
import time

# ── 상수 ─────────────────────────────────────────────────────────────────
ROAS_GREEN  = 8.0
ROAS_YELLOW = 5.0
BASE_DIR    = Path(__file__).parent

CH_COLOR = {"구글": "#4285F4", "메타": "#1877F2", "네이버": "#03C75A"}
BG       = "#ffffff"       # 배경: 흰색
CARD     = "#f8fafc"       # 카드: 매우 연한 회색
CARD2    = "#f1f5f9"       # 보조 카드 / 그리드
BORDER   = "#e2e8f0"       # 경계선
MAIN     = "#0f172a"       # 제목/주요 텍스트: 진한 네이비
MUTED    = "#64748b"       # 보조 텍스트: 중간 회색
GREEN    = "#059669"       # 녹색 (라이트 배경 대비)
RED      = "#dc2626"       # 빨강
AMBER    = "#d97706"       # 주황
BLUE     = "#2563eb"       # 파랑

PLOT_BASE = dict(
    plot_bgcolor=BG, paper_bgcolor=BG, font_color="#374151",
    legend=dict(bgcolor=CARD, bordercolor=BORDER),
    margin=dict(l=0, r=0, t=40, b=0),
)


# ── 페이지 설정 ───────────────────────────────────────────────────────────
st.set_page_config(
    page_title="퍼마 대시보드",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(f"""
<style>
  .stTabs [data-baseweb="tab-list"] {{
      background:{CARD}; border-radius:8px; padding:4px; gap:4px;
  }}
  .stTabs [data-baseweb="tab"] {{
      border-radius:6px; color:{MUTED}; padding:6px 14px;
  }}
  .stTabs [aria-selected="true"] {{
      background:{BG}; color:{MAIN} !important;
  }}
  [data-testid="stSidebar"] {{ background:{CARD}; }}
  .block-container {{ padding-top:2.5rem; }}
  header[data-testid="stHeader"] {{ background:transparent; }}
</style>""", unsafe_allow_html=True)


# ── 소재명 5속성 파싱 ─────────────────────────────────────────────────────
def parse_creative(name: str) -> tuple:
    """
    A/B 있음: [타입]_[카테고리]_[시즌]_[AB]_[버전]  (5파트)
    A/B 없음: [타입]_[카테고리]_[시즌]_[버전]        (4파트)
    """
    p = str(name).split("_")
    소재타입     = p[0] if len(p) > 0 else ""
    소재카테고리 = p[1] if len(p) > 1 else ""
    소재시즌     = p[2] if len(p) > 2 else ""
    if len(p) == 5:
        AB, 버전 = p[3], p[4]
    elif len(p) == 4:
        AB, 버전 = "", p[3]
    else:
        AB = 버전 = ""
    return 소재타입, 소재카테고리, 소재시즌, AB, 버전


# ── 데이터 로딩 ───────────────────────────────────────────────────────────
def _raw_signature() -> tuple[int, float]:
    """raw 폴더의 파일 개수 + 최신 mtime → 캐시 키. 새 파일 추가 시 자동 무효화."""
    base = BASE_DIR / "data" / "raw"
    files = list((base / "channel").glob("*.csv")) + list((base / "appsflyer").glob("*.csv"))
    if not files:
        return 0, 0.0
    return len(files), max(f.stat().st_mtime for f in files)


def _rebuild_master(base: Path) -> None:
    """raw 폴더 전체 스캔 → master CSV 재빌드 (중복 제거 + 날짜순 정렬)."""
    ch_files = sorted((base / "raw" / "channel").glob("*.csv"))
    af_files = sorted((base / "raw" / "appsflyer").glob("*.csv"))
    master_dir = base / "master"
    master_dir.mkdir(parents=True, exist_ok=True)

    df_ch = pd.concat([pd.read_csv(f) for f in ch_files], ignore_index=True)
    df_ch = df_ch.drop_duplicates().sort_values("일").reset_index(drop=True)
    df_ch.to_csv(master_dir / "channel_master.csv", index=False, encoding="utf-8-sig")

    df_af = pd.concat([pd.read_csv(f) for f in af_files], ignore_index=True)
    df_af = df_af.drop_duplicates().sort_values("일").reset_index(drop=True)
    df_af.to_csv(master_dir / "appsflyer_master.csv", index=False, encoding="utf-8-sig")


@st.cache_data
def load_data(raw_count: int, raw_mtime: float) -> pd.DataFrame | None:
    """
    raw_count / raw_mtime 가 바뀌면 캐시 자동 무효화 → 재로드.
    새 일별 CSV를 raw 폴더에 넣고 브라우저 새로고침만 하면 반영됨.
    """
    base = BASE_DIR / "data"
    ch_m = base / "master" / "channel_master.csv"
    af_m = base / "master" / "appsflyer_master.csv"

    # raw가 master보다 최신이거나 master가 없으면 재빌드
    raw_files = list((base / "raw" / "channel").glob("*.csv"))
    need_rebuild = (
        not ch_m.exists()
        or not af_m.exists()
        or (raw_files and max(f.stat().st_mtime for f in raw_files) > ch_m.stat().st_mtime)
    )
    if need_rebuild:
        _rebuild_master(base)

    df_ch = pd.read_csv(ch_m, parse_dates=["일"])
    df_af = pd.read_csv(af_m, parse_dates=["일"])
    if df_ch.empty or df_af.empty:
        return None

    # AF 컬럼 리네임 (채널 컬럼과 충돌 방지)
    df_af = df_af.rename(columns={
        "클릭":    "af_클릭",
        "회원가입": "af_회원가입",
        "구매":    "af_구매",
        "구매매출": "af_구매매출",
    }).drop(columns=["미디어소스"], errors="ignore")

    # 조인: 일 + 캠페인 + 그룹 + 소재 (4컬럼 복합키)
    df = pd.merge(df_ch, df_af, on=["일", "캠페인", "그룹", "소재"], how="left")

    # 소재명 5속성 파싱
    parsed = df["소재"].apply(parse_creative)
    df[["소재타입", "소재카테고리", "소재시즌", "AB", "버전"]] = pd.DataFrame(
        parsed.tolist(), index=df.index
    )

    # 기본 파생 지표 (AF 기준)
    df["ROAS_기본"]  = df["af_구매매출"] / df["비용"].replace(0, np.nan)
    df["CTR"]        = df["클릭"]        / df["노출"].replace(0, np.nan) * 100
    df["CVR"]        = df["af_구매"]     / df["af_클릭"].replace(0, np.nan) * 100
    df["AF커버리지"] = df["af_구매"]     / df["구매"].replace(0, np.nan) * 100

    return df


# ── 필터 적용 ─────────────────────────────────────────────────────────────
def apply_filters(df: pd.DataFrame, f: dict) -> pd.DataFrame:
    d = df.copy()

    if isinstance(f["date_range"], (list, tuple)) and len(f["date_range"]) == 2:
        s = pd.Timestamp(f["date_range"][0])
        e = pd.Timestamp(f["date_range"][1])
        d = d[(d["일"] >= s) & (d["일"] <= e)]

    col_map = [
        ("채널분류",    "분류"),
        ("채널",        "채널"),
        ("캠페인목적",  "목적"),
        ("그룹",        "그룹"),
        ("소재타입",    "타입"),
        ("소재카테고리","카테"),
        ("소재시즌",    "시즌"),
    ]
    for col, key in col_map:
        if f.get(key):
            d = d[d[col].isin(f[key])]

    if f.get("excl_brand"):
        d = d[~d["캠페인목적"].str.contains("브랜드KW", na=False)]

    # 전환 기준 파생 컬럼 (_접두어)
    is_channel = f.get("conv_basis") == "채널 기준"
    d["_회원가입"] = d["회원가입"]  if is_channel else d["af_회원가입"]
    d["_구매"]     = d["구매"]      if is_channel else d["af_구매"]
    d["_매출"]     = d["구매매출"]  if is_channel else d["af_구매매출"]
    d["_ROAS"]     = d["_매출"]  / d["비용"].replace(0, np.nan)
    d["_CPA"]      = d["비용"]   / d["_구매"].replace(0, np.nan)
    d["_CAC"]      = d["비용"]   / d["_회원가입"].replace(0, np.nan)

    return d


# ── 사이드바 ──────────────────────────────────────────────────────────────
def render_sidebar(df: pd.DataFrame) -> dict:
    st.sidebar.title("🔍 필터")

    min_d = df["일"].min().date()
    max_d = df["일"].max().date()
    date_range = st.sidebar.date_input(
        "기간", value=(min_d, max_d), min_value=min_d, max_value=max_d
    )

    def ms(label: str, col: str) -> list:
        opts = sorted(df[col].dropna().unique().tolist())
        return st.sidebar.multiselect(label, opts, default=opts)

    sel_분류 = ms("채널분류",   "채널분류")
    sel_채널 = ms("채널",       "채널")
    sel_목적 = ms("캠페인목적", "캠페인목적")
    sel_그룹 = ms("타겟그룹",   "그룹")

    st.sidebar.markdown("---")
    st.sidebar.subheader("소재 속성")
    sel_타입 = ms("타입",     "소재타입")
    sel_카테 = ms("카테고리", "소재카테고리")
    sel_시즌 = ms("시즌",     "소재시즌")

    st.sidebar.markdown("---")
    excl_brand = st.sidebar.toggle("브랜드KW 제외", value=True)
    conv_basis  = st.sidebar.radio("전환 기준", ["AF 기준", "채널 기준"], index=0)

    st.sidebar.markdown("---")
    # 데이터 상태 표시
    raw_dir = BASE_DIR / "data" / "raw" / "channel"
    ch_files = sorted(raw_dir.glob("*.csv"))
    if ch_files:
        latest = ch_files[-1].stem.replace("_channel", "")
        n_files = len(ch_files)
        st.sidebar.markdown(
            f'<div style="font-size:11px;color:{MUTED}">'
            f'📂 raw {n_files}일치 | 최신: <b style="color:{GREEN}">{latest}</b><br>'
            f'새 파일 추가 후 🔄 새로고침하면 자동 반영</div>',
            unsafe_allow_html=True,
        )
    if st.sidebar.button("🔄 데이터 강제 새로고침", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

    return dict(
        date_range=date_range,
        분류=sel_분류, 채널=sel_채널, 목적=sel_목적, 그룹=sel_그룹,
        타입=sel_타입, 카테=sel_카테, 시즌=sel_시즌,
        excl_brand=excl_brand, conv_basis=conv_basis,
    )


# ── KPI 행 헬퍼 ───────────────────────────────────────────────────────────
def _sdiv(a, b):
    try:
        return a / b if b and b != 0 else 0
    except Exception:
        return 0


def _wow_delta(df: pd.DataFrame, num: str, den: str | None = None) -> float | None:
    """최근 7일 vs 직전 7일 WoW delta (%). 데이터 부족 시 None 반환."""
    if df.empty or "일" not in df.columns:
        return None
    mx = df["일"].max()
    r = df[df["일"] > mx - pd.Timedelta(days=7)]
    p = df[
        (df["일"] > mx - pd.Timedelta(days=14))
        & (df["일"] <= mx - pd.Timedelta(days=7))
    ]
    if p.empty:
        return None
    rv = _sdiv(r[num].sum(), r[den].sum()) if den else r[num].sum()
    pv = _sdiv(p[num].sum(), p[den].sum()) if den else p[num].sum()
    return _sdiv(rv - pv, pv) * 100 if pv else None


def _delta_badge(delta: float | None, inv: bool = False) -> str:
    """WoW delta HTML badge. inv=True: 하락이 좋은 지표 (CPA/CAC)."""
    if delta is None:
        return f'<span style="font-size:11px;color:{BORDER}">WoW -</span>'
    good  = (delta > 0) ^ inv
    color = GREEN if good else RED
    sign  = "▲" if delta > 0 else "▼"
    return f'<span style="font-size:11px;color:{color}">{sign}{abs(delta):.1f}%</span>'


# ── KPI 행 렌더 ───────────────────────────────────────────────────────────
def render_kpi_row(df: pd.DataFrame):
    비용t = df["비용"].sum()
    노출t = df["노출"].sum()
    클릭t = df["클릭"].sum()
    가입t = df["_회원가입"].sum()
    매출t = df["_매출"].sum()

    rows = [
        ("총 광고비",   f"₩{비용t:,.0f}",
         _wow_delta(df, "비용"),              False),
        ("노출",        f"{노출t:,.0f}",
         _wow_delta(df, "노출"),              False),
        ("CTR",         f"{_sdiv(클릭t, 노출t)*100:.2f}%",
         _wow_delta(df, "클릭", "노출"),      False),
        ("신규 가입",   f"{가입t:,.0f}",
         _wow_delta(df, "_회원가입"),          False),
        ("CAC",         f"₩{_sdiv(비용t, 가입t):,.0f}",
         _wow_delta(df, "비용", "_회원가입"),  True),
        ("ROAS",        f"{_sdiv(매출t, 비용t):.2f}",
         _wow_delta(df, "_매출", "비용"),      False),
        ("AF 커버리지", f"{_sdiv(df['af_구매'].sum(), df['구매'].sum())*100:.1f}%",
         _wow_delta(df, "af_구매", "구매"),    False),
    ]

    cols = st.columns(7)
    for col, (label, val_str, delta, inv) in zip(cols, rows):
        with col:
            st.markdown(f"""
<div style="background:{CARD};border-radius:8px;padding:14px 10px;
            text-align:center;border:1px solid {BORDER}">
  <div style="font-size:10px;color:{MUTED};letter-spacing:.6px;
              margin-bottom:5px">{label.upper()}</div>
  <div style="font-size:17px;font-weight:700;color:{MAIN};
              margin-bottom:3px">{val_str}</div>
  {_delta_badge(delta, inv)}
</div>""", unsafe_allow_html=True)


# ── 탭 1: 전체 추세 ────────────────────────────────────────────────────────
def tab_trend(df: pd.DataFrame):
    daily = df.groupby("일").agg(
        비용=("비용", "sum"),
        _매출=("_매출", "sum"),
        af_구매매출=("af_구매매출", "sum"),
        클릭=("클릭", "sum"),
        노출=("노출", "sum"),
    ).reset_index()
    daily["ROAS"] = daily["af_구매매출"] / daily["비용"].replace(0, np.nan)

    # ① 일별 광고비(bar) vs 매출(line) — 이중 Y축
    fig1 = make_subplots(specs=[[{"secondary_y": True}]])
    fig1.add_trace(
        go.Bar(x=daily["일"], y=daily["비용"], name="광고비",
               marker_color=BLUE, opacity=0.8),
        secondary_y=False,
    )
    fig1.add_trace(
        go.Scatter(x=daily["일"], y=daily["_매출"], name="매출",
                   line=dict(color=GREEN, width=2.5), mode="lines+markers"),
        secondary_y=True,
    )
    fig1.update_layout(title="일별 광고비 vs 매출", height=340, **PLOT_BASE)
    fig1.update_yaxes(title_text="광고비 (₩)", secondary_y=False,
                      gridcolor=BORDER, tickformat=",.0f")
    fig1.update_yaxes(title_text="매출 (₩)",   secondary_y=True,
                      gridcolor=BORDER, tickformat=",.0f")
    fig1.update_xaxes(gridcolor=BORDER)
    st.plotly_chart(fig1, use_container_width=True)

    # ② 채널별 ROAS 추세
    ch_daily = df.groupby(["일", "채널"]).agg(
        비용=("비용", "sum"), af_구매매출=("af_구매매출", "sum"),
    ).reset_index()
    ch_daily["ROAS"] = ch_daily["af_구매매출"] / ch_daily["비용"].replace(0, np.nan)

    fig2 = px.line(
        ch_daily, x="일", y="ROAS", color="채널",
        color_discrete_map=CH_COLOR,
        title="채널별 ROAS 추세", markers=True, height=320,
    )
    fig2.add_hline(y=ROAS_GREEN,  line_dash="dot", line_color=GREEN,
                   annotation_text=f"목표 ROAS {ROAS_GREEN}")
    fig2.add_hline(y=ROAS_YELLOW, line_dash="dot", line_color=AMBER,
                   annotation_text=f"경고 ROAS {ROAS_YELLOW}")
    fig2.update_layout(**PLOT_BASE,
                       xaxis=dict(gridcolor=BORDER), yaxis=dict(gridcolor=BORDER))
    st.plotly_chart(fig2, use_container_width=True)

    # ③ 채널분류별 비용 누적 영역
    cl_daily = df.groupby(["일", "채널분류"]).agg(비용=("비용", "sum")).reset_index()
    fig3 = px.area(
        cl_daily, x="일", y="비용", color="채널분류",
        title="채널분류(외부/자체)별 일별 비용", height=260,
    )
    fig3.update_layout(**PLOT_BASE,
                       xaxis=dict(gridcolor=BORDER), yaxis=dict(gridcolor=BORDER))
    st.plotly_chart(fig3, use_container_width=True)


# ── 탭 2: 목적별 ──────────────────────────────────────────────────────────
def tab_purpose(df: pd.DataFrame):
    agg = df.groupby("캠페인목적").agg(
        비용=("비용", "sum"), 매출=("_매출", "sum"),
        구매=("_구매", "sum"), 노출=("노출", "sum"), 클릭=("클릭", "sum"),
    ).reset_index()
    agg["ROAS"] = agg["매출"] / agg["비용"].replace(0, np.nan)
    agg["CPA"]  = agg["비용"] / agg["구매"].replace(0, np.nan)
    agg["CTR"]  = agg["클릭"] / agg["노출"].replace(0, np.nan) * 100
    agg = agg.sort_values("ROAS", ascending=False)

    col1, col2 = st.columns(2)
    with col1:
        fig = px.bar(
            agg, x="ROAS", y="캠페인목적", orientation="h",
            color="ROAS", color_continuous_scale="RdYlGn",
            title="캠페인 목적별 ROAS", text="ROAS", height=380,
        )
        fig.update_traces(texttemplate="%{x:.2f}", textposition="outside")
        fig.update_layout(**PLOT_BASE, showlegend=False,
                          coloraxis_showscale=False,
                          xaxis=dict(gridcolor=BORDER),
                          yaxis=dict(gridcolor=BORDER))
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        fig2 = px.pie(
            agg, values="비용", names="캠페인목적",
            title="캠페인 목적별 비용 비중", hole=0.42, height=380,
        )
        fig2.update_layout(**{k: v for k, v in PLOT_BASE.items()
                               if k not in ("xaxis", "yaxis")})
        st.plotly_chart(fig2, use_container_width=True)

    # 비용 vs 매출 grouped bar
    melt = agg.melt(
        id_vars="캠페인목적", value_vars=["비용", "매출"],
        var_name="구분", value_name="금액",
    )
    fig3 = px.bar(
        melt, x="캠페인목적", y="금액", color="구분", barmode="group",
        title="목적별 비용 vs 매출", height=320,
        color_discrete_map={"비용": BLUE, "매출": GREEN},
    )
    fig3.update_layout(**PLOT_BASE,
                       xaxis=dict(gridcolor=BORDER), yaxis=dict(gridcolor=BORDER))
    st.plotly_chart(fig3, use_container_width=True)

    # 상세 테이블
    disp = agg[["캠페인목적", "비용", "매출", "ROAS", "CPA", "CTR"]].copy()
    disp["비용"] = disp["비용"].map("₩{:,.0f}".format)
    disp["매출"] = disp["매출"].map("₩{:,.0f}".format)
    disp["ROAS"] = disp["ROAS"].map("{:.2f}".format)
    disp["CPA"]  = disp["CPA"].map("₩{:,.0f}".format)
    disp["CTR"]  = disp["CTR"].map("{:.2f}%".format)
    st.dataframe(disp, use_container_width=True, hide_index=True)


# ── 탭 3: 소재 속성 ── 공통 차트 헬퍼 ─────────────────────────────────────
def _attr_charts(df: pd.DataFrame, attr: str):
    agg = df.groupby(attr).agg(
        비용=("비용", "sum"), 매출=("_매출", "sum"),
        구매=("_구매", "sum"), 노출=("노출", "sum"), 클릭=("클릭", "sum"),
    ).reset_index()
    agg = agg[agg[attr].notna() & (agg[attr] != "")]
    if agg.empty:
        st.info(f"'{attr}' 데이터가 없습니다.")
        return
    agg["ROAS"] = agg["매출"] / agg["비용"].replace(0, np.nan)
    agg["CPA"]  = agg["비용"] / agg["구매"].replace(0, np.nan)
    agg["CTR"]  = agg["클릭"] / agg["노출"].replace(0, np.nan) * 100
    agg = agg.sort_values("ROAS", ascending=False)

    col1, col2 = st.columns(2)
    with col1:
        fig = px.bar(
            agg, x=attr, y="ROAS", color="ROAS",
            color_continuous_scale="RdYlGn",
            title=f"{attr}별 ROAS", text="ROAS", height=320,
        )
        fig.update_traces(texttemplate="%{y:.2f}", textposition="outside")
        fig.update_layout(**PLOT_BASE, showlegend=False,
                          coloraxis_showscale=False,
                          xaxis=dict(gridcolor=BORDER), yaxis=dict(gridcolor=BORDER))
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        fig2 = px.bar(
            agg, x=attr, y="CPA", title=f"{attr}별 CPA",
            color="CPA", color_continuous_scale="RdYlGn_r", text="CPA", height=320,
        )
        fig2.update_traces(texttemplate="₩%{y:,.0f}", textposition="outside")
        fig2.update_layout(**PLOT_BASE, showlegend=False,
                           coloraxis_showscale=False,
                           xaxis=dict(gridcolor=BORDER), yaxis=dict(gridcolor=BORDER))
        st.plotly_chart(fig2, use_container_width=True)

    fig3 = px.pie(agg, values="비용", names=attr,
                  title=f"{attr}별 비용 비중", hole=0.35, height=280)
    fig3.update_layout(**{k: v for k, v in PLOT_BASE.items()
                           if k not in ("xaxis", "yaxis")})
    st.plotly_chart(fig3, use_container_width=True)

    disp = agg[[attr, "비용", "매출", "ROAS", "CPA", "CTR"]].copy()
    disp["비용"] = disp["비용"].map("₩{:,.0f}".format)
    disp["매출"] = disp["매출"].map("₩{:,.0f}".format)
    disp["ROAS"] = disp["ROAS"].map("{:.2f}".format)
    disp["CPA"]  = disp["CPA"].map("₩{:,.0f}".format)
    disp["CTR"]  = disp["CTR"].map("{:.2f}%".format)
    st.dataframe(disp, use_container_width=True, hide_index=True)


def tab_creative(df: pd.DataFrame):
    subs = st.tabs(["📌 소재타입", "🏷️ 카테고리", "❄️ 시즌", "🅰️🅱️ A/B", "🔢 버전"])
    for attr, sub in zip(
        ["소재타입", "소재카테고리", "소재시즌", "AB", "버전"], subs
    ):
        with sub:
            _attr_charts(df, attr)


# ── 탭 4: A/B 테스트 ──────────────────────────────────────────────────────
def tab_ab(df: pd.DataFrame):
    ab_df = df[df["AB"].isin(["A", "B", "C"])].copy()
    if ab_df.empty:
        st.info("A/B 소재 데이터가 없습니다. (소재명 4번째 파트가 A/B/C 여야 함)")
        return

    ab_df["_key"] = (
        ab_df["채널"]        + " | "
        + ab_df["캠페인목적"]  + " | "
        + ab_df["소재타입"]    + " | "
        + ab_df["소재카테고리"] + " | "
        + ab_df["소재시즌"]
    )

    agg = ab_df.groupby(["_key", "AB"]).agg(
        비용=("비용", "sum"), 매출=("_매출", "sum"),
        구매=("_구매", "sum"), 클릭=("클릭", "sum"), 노출=("노출", "sum"),
    ).reset_index()
    agg["ROAS"] = agg["매출"] / agg["비용"].replace(0, np.nan)
    agg["CPA"]  = agg["비용"] / agg["구매"].replace(0, np.nan)
    agg["CTR"]  = agg["클릭"] / agg["노출"].replace(0, np.nan) * 100

    valid_keys = (
        agg.groupby("_key")["AB"].nunique()
        .pipe(lambda s: s[s >= 2])
        .index.tolist()
    )
    if not valid_keys:
        st.info("비교 가능한 A/B 쌍이 없습니다. (같은 채널/목적/타입/카테/시즌에 A와 B 모두 필요)")
        return

    st.markdown(f"**{len(valid_keys)}개** 비교 그룹 발견")
    st.markdown("<br>", unsafe_allow_html=True)

    for key in valid_keys:
        grp     = agg[agg["_key"] == key].copy().set_index("AB")
        best_ab = grp["ROAS"].idxmax() if not grp["ROAS"].isna().all() else None
        ab_vals = sorted(grp.index.tolist())

        st.markdown(f"#### 📊 {key}")
        cols = st.columns(len(ab_vals))

        for ab_v, col in zip(ab_vals, cols):
            if ab_v not in grp.index:
                continue
            row      = grp.loc[ab_v]
            winner   = ab_v == best_ab
            border_c = AMBER if winner else BORDER
            badge    = " 🏆" if winner else ""
            roas_c   = (GREEN if row["ROAS"] >= ROAS_GREEN
                        else AMBER if row["ROAS"] >= ROAS_YELLOW
                        else RED)
            with col:
                st.markdown(f"""
<div style="background:{CARD};border:2px solid {border_c};border-radius:10px;
            padding:18px;text-align:center">
  <div style="font-size:30px;font-weight:900;color:{MAIN};margin-bottom:4px">
    {ab_v}{badge}
  </div>
  <hr style="border-color:{BORDER};margin:10px 0">
  <div style="font-size:11px;color:{MUTED}">ROAS</div>
  <div style="font-size:28px;font-weight:700;color:{roas_c};margin-bottom:12px">
    {row['ROAS']:.2f}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left">
    <div>
      <div style="font-size:10px;color:{MUTED}">비용</div>
      <div style="font-size:13px;color:{MAIN}">₩{row['비용']:,.0f}</div>
    </div>
    <div>
      <div style="font-size:10px;color:{MUTED}">CPA</div>
      <div style="font-size:13px;color:{MAIN}">₩{row['CPA']:,.0f}</div>
    </div>
    <div>
      <div style="font-size:10px;color:{MUTED}">구매</div>
      <div style="font-size:13px;color:{MAIN}">{row['구매']:,.0f}</div>
    </div>
    <div>
      <div style="font-size:10px;color:{MUTED}">CTR</div>
      <div style="font-size:13px;color:{MAIN}">{row['CTR']:.2f}%</div>
    </div>
  </div>
</div>""", unsafe_allow_html=True)

        grp_r = grp.reset_index()
        fig = px.bar(
            grp_r, x="AB", y="ROAS", color="ROAS",
            color_continuous_scale="RdYlGn", text="ROAS", height=200,
        )
        fig.update_traces(texttemplate="%{y:.2f}", textposition="outside")
        fig.update_layout(**PLOT_BASE, showlegend=False, coloraxis_showscale=False,
                          margin=dict(l=0, r=0, t=10, b=0),
                          xaxis=dict(gridcolor=BORDER), yaxis=dict(gridcolor=BORDER))
        st.plotly_chart(fig, use_container_width=True)
        st.markdown("---")


# ── 탭 5: 타겟 그룹 ────────────────────────────────────────────────────────
def tab_target(df: pd.DataFrame):
    agg = df.groupby("그룹").agg(
        비용=("비용", "sum"), 매출=("_매출", "sum"),
        구매=("_구매", "sum"), 회원가입=("_회원가입", "sum"),
        노출=("노출", "sum"), 클릭=("클릭", "sum"),
    ).reset_index()
    agg["ROAS"] = agg["매출"]  / agg["비용"].replace(0, np.nan)
    agg["CPA"]  = agg["비용"]  / agg["구매"].replace(0, np.nan)
    agg["CTR"]  = agg["클릭"]  / agg["노출"].replace(0, np.nan) * 100
    agg["CVR"]  = agg["구매"]  / agg["클릭"].replace(0, np.nan) * 100
    agg = agg.sort_values("ROAS", ascending=False)

    col1, col2 = st.columns(2)
    with col1:
        fig = px.bar(
            agg, x="그룹", y="ROAS", color="그룹",
            title="타겟 그룹별 ROAS", text="ROAS", height=340,
        )
        fig.update_traces(texttemplate="%{y:.2f}", textposition="outside")
        fig.add_hline(y=ROAS_GREEN, line_dash="dot", line_color=GREEN,
                      annotation_text=f"목표 {ROAS_GREEN}")
        fig.update_layout(**PLOT_BASE, showlegend=False,
                          xaxis=dict(gridcolor=BORDER), yaxis=dict(gridcolor=BORDER))
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        fig2 = px.bar(
            agg, x="그룹", y="CPA", color="그룹",
            title="타겟 그룹별 CPA", text="CPA", height=340,
        )
        fig2.update_traces(texttemplate="₩%{y:,.0f}", textposition="outside")
        fig2.update_layout(**PLOT_BASE, showlegend=False,
                           xaxis=dict(gridcolor=BORDER), yaxis=dict(gridcolor=BORDER))
        st.plotly_chart(fig2, use_container_width=True)

    col3, col4 = st.columns(2)
    with col3:
        fig3 = px.bar(
            agg, x="그룹", y="CTR", color="그룹",
            title="타겟 그룹별 CTR", text="CTR", height=300,
        )
        fig3.update_traces(texttemplate="%{y:.2f}%", textposition="outside")
        fig3.update_layout(**PLOT_BASE, showlegend=False,
                           xaxis=dict(gridcolor=BORDER), yaxis=dict(gridcolor=BORDER))
        st.plotly_chart(fig3, use_container_width=True)

    with col4:
        fig4 = px.bar(
            agg, x="그룹", y="CVR", color="그룹",
            title="타겟 그룹별 CVR (AF클릭→구매)", text="CVR", height=300,
        )
        fig4.update_traces(texttemplate="%{y:.2f}%", textposition="outside")
        fig4.update_layout(**PLOT_BASE, showlegend=False,
                           xaxis=dict(gridcolor=BORDER), yaxis=dict(gridcolor=BORDER))
        st.plotly_chart(fig4, use_container_width=True)

    # 레이더 차트 (4지표 정규화)
    metrics = ["ROAS", "CPA", "CTR", "CVR"]
    norm = agg[metrics].copy().astype(float)
    for m in metrics:
        rng = norm[m].max() - norm[m].min()
        norm[m] = (norm[m] - norm[m].min()) / rng if rng > 0 else 0.5
    norm["CPA"] = 1 - norm["CPA"]  # CPA: 낮을수록 좋음 → 반전

    fig5 = go.Figure()
    for i, row in agg.iterrows():
        vals = [norm.loc[i, m] for m in metrics]
        vals.append(vals[0])
        fig5.add_trace(go.Scatterpolar(
            r=vals, theta=metrics + [metrics[0]],
            fill="toself", name=row["그룹"], opacity=0.6,
        ))
    fig5.update_layout(
        polar=dict(bgcolor=CARD2, radialaxis=dict(visible=False, range=[0, 1])),
        paper_bgcolor=BG, font_color="#374151",
        title="타겟 그룹 레이더 (정규화 | CPA는 반전)",
        height=420,
        legend=dict(bgcolor=CARD, bordercolor=BORDER),
    )
    st.plotly_chart(fig5, use_container_width=True)

    disp = agg[["그룹", "비용", "매출", "ROAS", "CPA", "CTR", "CVR"]].copy()
    disp["비용"] = disp["비용"].map("₩{:,.0f}".format)
    disp["매출"] = disp["매출"].map("₩{:,.0f}".format)
    disp["ROAS"] = disp["ROAS"].map("{:.2f}".format)
    disp["CPA"]  = disp["CPA"].map("₩{:,.0f}".format)
    disp["CTR"]  = disp["CTR"].map("{:.2f}%".format)
    disp["CVR"]  = disp["CVR"].map("{:.2f}%".format)
    st.dataframe(disp, use_container_width=True, hide_index=True)


# ── 탭 6: 캠페인 랭킹 ────────────────────────────────────────────────────
def _status_emoji(roas: float) -> str:
    if roas >= ROAS_GREEN:  return "🟢"
    if roas >= ROAS_YELLOW: return "🟡"
    return "🔴"


def tab_ranking(df: pd.DataFrame):
    agg = df.groupby(["채널", "캠페인", "캠페인목적"]).agg(
        비용=("비용", "sum"), 매출=("_매출", "sum"),
        구매=("_구매", "sum"), 노출=("노출", "sum"), 클릭=("클릭", "sum"),
    ).reset_index()
    agg["ROAS"] = agg["매출"] / agg["비용"].replace(0, np.nan)
    agg["CPA"]  = agg["비용"] / agg["구매"].replace(0, np.nan)
    agg["CTR"]  = agg["클릭"] / agg["노출"].replace(0, np.nan) * 100
    agg = agg.sort_values("ROAS", ascending=False).reset_index(drop=True)

    max_roas = agg["ROAS"].max() if not agg["ROAS"].isna().all() else 1.0

    # 상태별 요약 카드
    n_g = int((agg["ROAS"] >= ROAS_GREEN).sum())
    n_y = int(((agg["ROAS"] >= ROAS_YELLOW) & (agg["ROAS"] < ROAS_GREEN)).sum())
    n_r = int((agg["ROAS"] < ROAS_YELLOW).sum())

    c1, c2, c3 = st.columns(3)
    for col, emoji, n, label, color in [
        (c1, "🟢", n_g, f"ROAS ≥ {ROAS_GREEN}",               GREEN),
        (c2, "🟡", n_y, f"ROAS {ROAS_YELLOW} ~ {ROAS_GREEN}", AMBER),
        (c3, "🔴", n_r, f"ROAS < {ROAS_YELLOW}",              RED),
    ]:
        with col:
            st.markdown(f"""
<div style="background:{CARD};border-radius:8px;padding:14px;text-align:center;
            border:1px solid {BORDER};margin-bottom:4px">
  <div style="font-size:28px;margin-bottom:4px">{emoji}</div>
  <div style="font-size:24px;font-weight:700;color:{color}">{n}개</div>
  <div style="font-size:11px;color:{MUTED};margin-top:2px">{label}</div>
</div>""", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # 캠페인별 ROAS 프로그레스 카드
    for _, row in agg.iterrows():
        pct   = int(row["ROAS"] / max_roas * 100)
        s_em  = _status_emoji(row["ROAS"])
        bar_c = (GREEN if row["ROAS"] >= ROAS_GREEN
                 else AMBER if row["ROAS"] >= ROAS_YELLOW
                 else RED)
        st.markdown(f"""
<div style="background:{CARD};border-radius:8px;padding:14px 18px;
            margin-bottom:8px;border:1px solid {BORDER}">
  <div style="display:flex;justify-content:space-between;align-items:center;
              margin-bottom:10px;flex-wrap:wrap;gap:8px">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="font-size:18px">{s_em}</span>
      <span style="font-size:14px;font-weight:600;color:{MAIN}">{row['캠페인']}</span>
      <span style="background:{BORDER};color:{MUTED};font-size:10px;
                   padding:2px 8px;border-radius:4px">{row['채널']}</span>
      <span style="background:{BORDER};color:{MUTED};font-size:10px;
                   padding:2px 8px;border-radius:4px">{row['캠페인목적']}</span>
    </div>
    <div style="text-align:right;white-space:nowrap">
      <span style="font-size:20px;font-weight:700;color:{bar_c}">
        ROAS {row['ROAS']:.2f}
      </span>
      <span style="font-size:12px;color:{MUTED};margin-left:14px">
        비용 ₩{row['비용']:,.0f}
      </span>
      <span style="font-size:12px;color:{MUTED};margin-left:10px">
        CPA ₩{row['CPA']:,.0f}
      </span>
      <span style="font-size:12px;color:{MUTED};margin-left:10px">
        구매 {row['구매']:,.0f}
      </span>
    </div>
  </div>
  <div style="background:{CARD2};border-radius:4px;height:6px;width:100%;overflow:hidden">
    <div style="background:{bar_c};height:6px;border-radius:4px;
                width:{pct}%;transition:width .3s ease"></div>
  </div>
</div>""", unsafe_allow_html=True)


# ── 메인 ─────────────────────────────────────────────────────────────────
def main():
    st.markdown(f"""
<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
  <span style="font-size:26px;font-weight:800;color:{MAIN}">
    📊 퍼포먼스 마케팅 대시보드
  </span>
  <span style="background:{CARD};color:{MUTED};font-size:11px;
               padding:3px 10px;border-radius:20px;border:1px solid {BORDER}">
    채널 + AppsFlyer 통합
  </span>
</div>""", unsafe_allow_html=True)
    st.divider()

    raw_count, raw_mtime = _raw_signature()
    df_raw = load_data(raw_count, raw_mtime)
    if df_raw is None:
        st.error(
            "데이터 파일을 찾을 수 없습니다.\n\n"
            "• `data/master/channel_master.csv` + `appsflyer_master.csv`  또는\n"
            "• `data/raw/channel/*.csv` + `data/raw/appsflyer/*.csv` 에 파일을 넣고 새로고침하세요."
        )
        st.stop()

    filters = render_sidebar(df_raw)
    df = apply_filters(df_raw, filters)

    if df.empty:
        st.warning("선택한 필터 조건에 맞는 데이터가 없습니다.")
        st.stop()

    render_kpi_row(df)
    st.markdown("<br>", unsafe_allow_html=True)

    t1, t2, t3, t4, t5, t6 = st.tabs([
        "📈 전체 추세",
        "🎯 목적별",
        "🎨 소재 속성",
        "🅰️🅱️ A/B 테스트",
        "👥 타겟그룹",
        "🏆 캠페인 랭킹",
    ])
    with t1: tab_trend(df)
    with t2: tab_purpose(df)
    with t3: tab_creative(df)
    with t4: tab_ab(df)
    with t5: tab_target(df)
    with t6: tab_ranking(df)


if __name__ == "__main__":
    main()
