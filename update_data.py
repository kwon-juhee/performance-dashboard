"""
일별 데이터 적재 스크립트
사용: python update_data.py <channel_csv> <appsflyer_csv> [날짜 YYYY-MM-DD]

예:
  python update_data.py ~/Downloads/channel_today.csv ~/Downloads/af_today.csv
  python update_data.py ~/Downloads/channel.csv ~/Downloads/af.csv 2025-04-01

- 날짜를 생략하면 CSV 내 '일' 컬럼의 첫 번째 값을 자동 사용
- data/raw/ 에 복사 후 data/master/ 자동 재빌드
- 이후 Streamlit 브라우저에서 새로고침하면 즉시 반영
"""

import sys
import shutil
import pandas as pd
from pathlib import Path

BASE = Path(__file__).parent / "data"
CH_RAW = BASE / "raw" / "channel"
AF_RAW = BASE / "raw" / "appsflyer"
MASTER  = BASE / "master"


def rebuild_master() -> tuple[int, int]:
    MASTER.mkdir(parents=True, exist_ok=True)

    ch_files = sorted(CH_RAW.glob("*_channel.csv"))
    df_ch = pd.concat([pd.read_csv(f) for f in ch_files], ignore_index=True)
    df_ch = df_ch.drop_duplicates().sort_values("일").reset_index(drop=True)
    df_ch.to_csv(MASTER / "channel_master.csv", index=False, encoding="utf-8-sig")

    af_files = sorted(AF_RAW.glob("*_appsflyer.csv"))
    df_af = pd.concat([pd.read_csv(f) for f in af_files], ignore_index=True)
    df_af = df_af.drop_duplicates().sort_values("일").reset_index(drop=True)
    df_af.to_csv(MASTER / "appsflyer_master.csv", index=False, encoding="utf-8-sig")

    return len(df_ch), len(df_af)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    ch_src = Path(sys.argv[1]).expanduser()
    af_src = Path(sys.argv[2]).expanduser()

    if not ch_src.exists():
        print(f"[오류] 파일 없음: {ch_src}")
        sys.exit(1)
    if not af_src.exists():
        print(f"[오류] 파일 없음: {af_src}")
        sys.exit(1)

    # 날짜 결정
    if len(sys.argv) >= 4:
        date_str = sys.argv[3]
    else:
        df_tmp = pd.read_csv(ch_src, nrows=1)
        date_str = str(df_tmp["일"].iloc[0])[:10]

    print(f"날짜: {date_str}")

    # 복사
    CH_RAW.mkdir(parents=True, exist_ok=True)
    AF_RAW.mkdir(parents=True, exist_ok=True)

    ch_dest = CH_RAW / f"{date_str}_channel.csv"
    af_dest = AF_RAW / f"{date_str}_appsflyer.csv"

    shutil.copy2(ch_src, ch_dest)
    shutil.copy2(af_src, af_dest)
    print(f"복사 완료: {ch_dest.name}, {af_dest.name}")

    # 마스터 재빌드
    print("master 재빌드 중...", end=" ")
    n_ch, n_af = rebuild_master()
    print(f"완료 (channel {n_ch}행 / appsflyer {n_af}행)")
    print("✅ Streamlit 브라우저에서 새로고침(F5)하면 즉시 반영됩니다.")


if __name__ == "__main__":
    main()
