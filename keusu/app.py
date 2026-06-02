from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

APP_DIR = Path(__file__).resolve().parent
DATA_FILE = APP_DIR / "客诉台账.xlsx"

REQUIRED_COLUMNS = [
    "发生时间",
    "年",
    "月",
    "问题描述",
    "原因类别",
    "原因分析",
    "临时措施",
    "长期措施",
    "是否根本解决",
]

TABLE_COLUMNS = [
    "发生时间",
    "问题描述",
    "原因分析",
    "临时措施",
    "长期措施",
    "是否根本解决",
]

COLUMN_ALIASES = {
    "原因分类": "原因类别",
    "是否根本解": "是否根本解决",
}


@dataclass
class WarningSignal:
    mode: str
    label: str
    repeat_count: int
    repeat_months: list[str]
    last_seen: pd.Timestamp
    row_ids: tuple[int, ...]


def normalize_text(value: object) -> str:
    text = "" if value is None else str(value)
    return text.replace("\r\n", "\n").replace("\r", "\n").strip()


def normalize_signature(value: object) -> str:
    text = normalize_text(value).lower()
    return re.sub(r"[\W_]+", "", text, flags=re.UNICODE)


def is_root_solved(value: object) -> bool:
    return normalize_text(value) in {"是", "yes", "true", "已解决", "已关闭"}


def has_complete_long_term_measure(value: object) -> bool:
    text = normalize_text(value)
    compact = normalize_signature(text)
    return bool(
        compact
        and (
            len(compact) >= 18
            or "\n" in text
            or "1." in text
            or "1、" in text
            or "①" in text
            or "；" in text
            or ";" in text
        )
    )


def similarity(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    return SequenceMatcher(a=left, b=right).ratio()


@st.cache_data(show_spinner=False)
def load_complaint_data() -> pd.DataFrame:
    if not DATA_FILE.exists():
        raise FileNotFoundError(f"未找到数据源: {DATA_FILE}")

    df = pd.read_excel(DATA_FILE, sheet_name=0, engine="openpyxl")
    df = df.rename(columns=COLUMN_ALIASES).copy()

    if "发生时间" not in df.columns:
        raise ValueError("源表缺少“发生时间”列。")

    df["发生时间"] = pd.to_datetime(df["发生时间"], errors="coerce")
    df = df.dropna(subset=["发生时间"]).reset_index(drop=True)

    if "年" not in df.columns:
        df["年"] = df["发生时间"].dt.year
    else:
        df["年"] = pd.to_numeric(df["年"], errors="coerce").fillna(df["发生时间"].dt.year)

    if "月" not in df.columns:
        df["月"] = df["发生时间"].dt.month
    else:
        df["月"] = pd.to_numeric(df["月"], errors="coerce").fillna(df["发生时间"].dt.month)

    df["年"] = df["年"].astype(int)
    df["月"] = df["月"].astype(int)

    for column in ["问题描述", "原因类别", "原因分析", "临时措施", "长期措施", "是否根本解决"]:
        if column not in df.columns:
            df[column] = ""
        df[column] = df[column].map(normalize_text)

    for column in REQUIRED_COLUMNS:
        if column not in df.columns:
            raise ValueError(f"源表缺少核心字段: {column}")

    df["月份标签"] = df["发生时间"].dt.to_period("M").astype(str)
    df["_问题描述标准"] = df["问题描述"].map(normalize_signature)
    df["_原因分析标准"] = df["原因分析"].map(normalize_signature)
    df["_记录ID"] = df.index.astype(int)
    return df


def apply_theme() -> None:
    st.markdown(
        """
        <style>
        :root {
          --bg: #05080d;
          --panel: #0d131b;
          --line: #1c2a38;
          --text: #e6edf5;
          --muted: #7f91a7;
          --accent: #78d6ff;
          --alert: #ff8b5e;
        }
        .stApp {
          background:
            radial-gradient(circle at top right, rgba(120, 214, 255, 0.08), transparent 32%),
            linear-gradient(180deg, #04070b 0%, #071018 100%);
          color: var(--text);
        }
        [data-testid="stAppViewContainer"] {
          background: transparent;
        }
        [data-testid="stSidebar"] {
          background: rgba(8, 12, 18, 0.94);
          border-right: 1px solid rgba(120, 214, 255, 0.08);
        }
        .block-container {
          padding-top: 2rem;
          padding-bottom: 3rem;
          max-width: 1280px;
        }
        .panel {
          border: 1px solid rgba(120, 214, 255, 0.08);
          border-radius: 18px;
          padding: 1rem 1.1rem;
          background: linear-gradient(180deg, rgba(13, 19, 27, 0.96), rgba(8, 13, 19, 0.94));
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
          margin-bottom: 1rem;
        }
        .panel-title {
          font-size: 0.76rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 0.6rem;
        }
        .warning-box {
          border: 1px solid rgba(255, 139, 94, 0.22);
          background: linear-gradient(180deg, rgba(54, 22, 16, 0.95), rgba(27, 14, 10, 0.96));
          border-radius: 18px;
          padding: 1rem 1.1rem;
          margin-bottom: 1rem;
          color: #ffd6c4;
        }
        .warning-box strong {
          color: #fff4ee;
        }
        .warning-line {
          margin-top: 0.45rem;
          font-size: 0.93rem;
          line-height: 1.45;
        }
        .subtle-box {
          border: 1px solid rgba(120, 214, 255, 0.08);
          background: rgba(13, 19, 27, 0.86);
          border-radius: 18px;
          padding: 1rem 1.1rem;
          margin-bottom: 1rem;
          color: #9eb0c4;
        }
        .hero {
          margin-bottom: 1rem;
        }
        .hero h1 {
          margin: 0;
          font-size: 2.2rem;
          letter-spacing: 0.01em;
          color: var(--text);
        }
        .hero p {
          margin: 0.45rem 0 0;
          color: var(--muted);
        }
        div[data-testid="stDataFrame"] {
          border: 1px solid rgba(120, 214, 255, 0.08);
          border-radius: 16px;
          overflow: hidden;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def build_filters(df: pd.DataFrame) -> pd.DataFrame:
    years = sorted(df["年"].dropna().unique().tolist(), reverse=True)
    months = sorted(df["月"].dropna().unique().tolist())

    with st.sidebar:
        st.markdown("### 数据过滤")
        selected_years = st.multiselect("年份", years, default=years)
        selected_months = st.multiselect("月份", months, default=months)

    filtered = df.copy()
    if selected_years:
        filtered = filtered[filtered["年"].isin(selected_years)]
    if selected_months:
        filtered = filtered[filtered["月"].isin(selected_months)]
    return filtered


def build_monthly_series(df: pd.DataFrame) -> pd.DataFrame:
    monthly = (
        df.assign(月份=df["发生时间"].dt.to_period("M").dt.to_timestamp())
        .groupby("月份", as_index=False)
        .size()
        .rename(columns={"size": "异常次数"})
        .sort_values("月份")
    )
    monthly["月份标签"] = monthly["月份"].dt.strftime("%Y-%m")
    return monthly


def render_monthly_timeline(df: pd.DataFrame) -> None:
    st.markdown('<div class="panel-title">系统流血点时间序列</div>', unsafe_allow_html=True)
    monthly = build_monthly_series(df)

    fig = go.Figure()
    fig.add_bar(
        x=monthly["月份标签"],
        y=monthly["异常次数"],
        name="异常次数",
        marker_color="#4fb3ff",
        opacity=0.42,
    )
    fig.add_scatter(
        x=monthly["月份标签"],
        y=monthly["异常次数"],
        mode="lines+markers",
        name="趋势",
        line={"color": "#9ae7ff", "width": 3},
        marker={"size": 9, "color": "#d7f6ff", "line": {"color": "#4fb3ff", "width": 1}},
    )
    fig.update_layout(
        height=380,
        margin={"l": 16, "r": 16, "t": 12, "b": 12},
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        hovermode="x unified",
        legend={"orientation": "h", "y": 1.08, "x": 1, "xanchor": "right"},
        xaxis={"title": "", "tickangle": -28, "gridcolor": "rgba(127,145,167,0.08)"},
        yaxis={"title": "异常次数", "gridcolor": "rgba(127,145,167,0.12)", "zeroline": False},
        font={"color": "#dce7f3"},
    )
    st.plotly_chart(fig, use_container_width=True)


def render_category_donut(df: pd.DataFrame) -> None:
    st.markdown('<div class="panel-title">底层 Bug 定性分析</div>', unsafe_allow_html=True)
    category = (
        df.assign(原因类别=df["原因类别"].replace("", "未分类"))
        .groupby("原因类别", as_index=False)
        .size()
        .rename(columns={"size": "异常次数"})
        .sort_values("异常次数", ascending=False)
    )

    fig = go.Figure(
        data=[
            go.Pie(
                labels=category["原因类别"],
                values=category["异常次数"],
                hole=0.62,
                sort=False,
                textinfo="label+percent",
                textposition="outside",
                marker={
                    "colors": [
                        "#9ae7ff",
                        "#5ac8fa",
                        "#3d8bfd",
                        "#1e5eff",
                        "#7f56d9",
                        "#ff8b5e",
                        "#7f91a7",
                    ]
                },
                hovertemplate="%{label}<br>异常次数=%{value}<br>占比=%{percent}<extra></extra>",
            )
        ]
    )
    fig.update_layout(
        height=420,
        margin={"l": 12, "r": 12, "t": 12, "b": 12},
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font={"color": "#dce7f3"},
        showlegend=False,
    )
    st.plotly_chart(fig, use_container_width=True)


def build_problem_warning_signals(df: pd.DataFrame) -> list[WarningSignal]:
    signals: list[WarningSignal] = []
    candidates = df[df["_问题描述标准"] != ""].copy()

    for _, group in candidates.groupby("_问题描述标准"):
        ordered = group.sort_values("发生时间")
        repeat_months = ordered["月份标签"].drop_duplicates().tolist()
        if len(repeat_months) <= 2:
            continue

        historical = ordered.iloc[:-1]
        history_has_closed_action = historical.apply(
            lambda row: is_root_solved(row["是否根本解决"])
            or has_complete_long_term_measure(row["长期措施"]),
            axis=1,
        ).any()
        if not history_has_closed_action:
            continue

        signals.append(
            WarningSignal(
                mode="问题描述重复",
                label=normalize_text(ordered.iloc[0]["问题描述"]),
                repeat_count=len(ordered),
                repeat_months=repeat_months,
                last_seen=ordered.iloc[-1]["发生时间"],
                row_ids=tuple(sorted(ordered["_记录ID"].astype(int).tolist())),
            )
        )

    return signals


def build_reason_warning_signals(df: pd.DataFrame, threshold: float = 0.88) -> list[WarningSignal]:
    reason_rows = df[df["_原因分析标准"] != ""].sort_values("发生时间").copy()
    if reason_rows.empty:
        return []

    signatures = reason_rows.set_index("_记录ID")["_原因分析标准"].to_dict()
    clusters: list[list[int]] = []

    for row_id in reason_rows["_记录ID"].astype(int).tolist():
        signature = signatures[row_id]
        placed = False
        for cluster in clusters:
            if any(similarity(signature, signatures[other_id]) >= threshold for other_id in cluster):
                cluster.append(row_id)
                placed = True
                break
        if not placed:
            clusters.append([row_id])

    signals: list[WarningSignal] = []
    for cluster in clusters:
        group = reason_rows.loc[reason_rows["_记录ID"].isin(cluster)].sort_values("发生时间")
        if len(group) < 3:
            continue

        repeat_months = group["月份标签"].drop_duplicates().tolist()
        if len(repeat_months) <= 2:
            continue

        historical = group.iloc[:-1]
        history_has_closed_action = historical.apply(
            lambda row: is_root_solved(row["是否根本解决"])
            or has_complete_long_term_measure(row["长期措施"]),
            axis=1,
        ).any()
        if not history_has_closed_action:
            continue

        signals.append(
            WarningSignal(
                mode="原因分析相似重复",
                label=normalize_text(group.iloc[0]["原因分析"]),
                repeat_count=len(group),
                repeat_months=repeat_months,
                last_seen=group.iloc[-1]["发生时间"],
                row_ids=tuple(sorted(group["_记录ID"].astype(int).tolist())),
            )
        )

    return signals


def build_warning_signals(df: pd.DataFrame) -> list[WarningSignal]:
    combined = build_problem_warning_signals(df) + build_reason_warning_signals(df)
    combined.sort(
        key=lambda item: (len(item.repeat_months), item.repeat_count, item.last_seen),
        reverse=True,
    )

    deduped: list[WarningSignal] = []
    seen: set[tuple[int, ...]] = set()
    for signal in combined:
        if signal.row_ids in seen:
            continue
        seen.add(signal.row_ids)
        deduped.append(signal)
    return deduped


def truncate_text(text: str, limit: int = 68) -> str:
    compact = normalize_text(text).replace("\n", " ")
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1] + "…"


def render_warning_box(df: pd.DataFrame) -> None:
    signals = build_warning_signals(df)
    if not signals:
        st.markdown(
            """
            <div class="subtle-box">
              <strong>🔥 高危重复爆发预警</strong><br />
              当前筛选范围内，未检测到“前次已宣称根治，但问题跨月重复爆发超过 2 次”的高危对象。
            </div>
            """,
            unsafe_allow_html=True,
        )
        return

    lines = []
    for signal in signals[:8]:
        months = " / ".join(signal.repeat_months)
        lines.append(
            f'<div class="warning-line">- [{signal.mode}] {truncate_text(signal.label)} '
            f'| 跨月重复 {len(signal.repeat_months)} 次 | 月份: {months}</div>'
        )

    st.markdown(
        '<div class="warning-box"><strong>🔥 高危重复爆发预警</strong><br />'
        + "".join(lines)
        + "</div>",
        unsafe_allow_html=True,
    )


def render_detail_table(df: pd.DataFrame) -> None:
    st.markdown('<div class="panel-title">核心物理因果链追踪</div>', unsafe_allow_html=True)
    table_df = (
        df.loc[:, TABLE_COLUMNS]
        .sort_values("发生时间", ascending=False)
        .assign(发生时间=lambda frame: frame["发生时间"].dt.strftime("%Y-%m-%d"))
    )
    st.dataframe(table_df, use_container_width=True, hide_index=True)


def render_header(df: pd.DataFrame) -> None:
    month_span = (
        f'{df["发生时间"].min().strftime("%Y-%m")} -> {df["发生时间"].max().strftime("%Y-%m")}'
        if not df.empty
        else "-"
    )
    st.markdown(
        f"""
        <div class="hero">
          <h1>客诉与制程异常数据看板</h1>
          <p>极简、冷酷、工程化的失效信号面板 | 样本数 {len(df)} | 观察区间 {month_span}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def main() -> None:
    st.set_page_config(
        page_title="客诉与制程异常数据看板",
        page_icon=":bar_chart:",
        layout="wide",
    )
    apply_theme()

    try:
        df = load_complaint_data()
    except Exception as exc:
        st.error(f"数据加载失败: {exc}")
        st.stop()

    filtered = build_filters(df)
    render_header(filtered)
    render_warning_box(filtered)

    st.markdown('<div class="panel">', unsafe_allow_html=True)
    render_monthly_timeline(filtered)
    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown('<div class="panel">', unsafe_allow_html=True)
    render_category_donut(filtered)
    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown('<div class="panel">', unsafe_allow_html=True)
    render_detail_table(filtered)
    st.markdown("</div>", unsafe_allow_html=True)


if __name__ == "__main__":
    main()
