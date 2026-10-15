# UI 변경 및 이전 디자인 복원

2026년 10월 15일, 왼쪽 메뉴가 있는 shadcn 스타일의 UI를 적용했습니다.

## 변경 전 디자인 백업

- GitHub 백업 브랜치: `backup/ui-before-shadcn-20261015`
- 변경 전 배포 커밋: `e9afc14691418b7176672a50e67cd6cc57f9dd23`
- 백업 브랜치 주소: https://github.com/woonam-good/woohwang/tree/backup/ui-before-shadcn-20261015
- 로컬 원본과 ZIP: 저장소 옆 `woohwang-backups/2026-10-15-before-shadcn-ui/`, `woohwang-backups/2026-10-15-before-shadcn-ui.zip`
- 로컬 백업의 `original-sha256.json`에 변경 전 파일의 검증값을 보관했습니다.

## 변경 범위

- `dashboard.css`: 새 화면 디자인만 담당하는 추가 스타일 파일입니다.
- `index.html`: 메뉴와 화면 안내 문구, 표 머리글, 새 스타일 파일 연결을 추가했습니다. 기존 입력·버튼·캔버스·기록 영역의 식별자와 속성은 유지했습니다.
- `app.js`, `styles.css`, `theme.css`, 기존 `assets/` 파일은 수정하지 않았습니다.
- 최근 벌어 가신 분·최다 승리·유동성 공급자의 이미지 파일과 배경 이미지 선언은 기존 것을 그대로 사용합니다.

## 이전 UI로 되돌릴 때

백업 브랜치의 `index.html`과 현재 파일을 비교하여 UI 변경만 복원하고 `dashboard.css` 연결을 제거하면 됩니다. 이번 변경 직후에는 변경 전 `index.html` 복사만으로도 기존 디자인이 돌아옵니다.

경기 데이터, Supabase 행, localStorage를 초기화하거나 과거 데이터로 덮어쓰지 않습니다. 저장소 전체를 과거 커밋으로 되돌리지 않고 UI 파일만 복원합니다. 이후 기능이 추가된 경우에는 현재 기능과 컨트롤을 유지하면서 UI 차이만 복원해야 합니다.
