# 무료 배포 및 도메인 연결 준비

이 폴더는 정적 웹사이트라 Vercel의 무료 Hobby 플랜에 바로 배포할 수 있습니다.

## 배포

1. [Vercel](https://vercel.com/)에 GitHub 계정 또는 이메일로 로그인합니다.
2. 새 프로젝트를 만들고 이 `team-scoreboard` 폴더를 업로드하거나 GitHub 저장소로 가져옵니다.
3. 별도 빌드 명령 없이 배포합니다. 배포가 끝나면 `프로젝트이름.vercel.app` 주소가 발급됩니다.

## wuhwang.co.kr 연결값

Vercel 프로젝트의 **Settings → Domains**에서 `wuhwang.co.kr`과 `www.wuhwang.co.kr`을 각각 추가한 뒤, 도메인 구매처의 DNS 설정에 아래 레코드를 만듭니다.

| 호스트 | 종류 | 값 |
| --- | --- | --- |
| `@` | A | `76.76.21.21` |
| `www` | CNAME | `cname.vercel-dns-0.com` |

DNS가 갱신되면 Vercel이 HTTPS 인증서를 자동 발급합니다. 기존에 같은 호스트의 A/CNAME 레코드가 있다면 먼저 제거하거나 변경해야 합니다.

## 알아둘 점

경기 기록과 다음 사다리 팀 순서는 Supabase의 공용 `scoreboard_state` 행에 저장됩니다. 각 브라우저의 `today-team-game-v2` 기록은 처음 접속할 때 서버 기록에 중복 없이 합쳐지고, 이후에는 로컬 백업으로 유지됩니다. 서버 연결이 실패하면 변경 버튼이 비활성화되므로 기록을 서버에 저장하지 못한 채 성공한 것처럼 표시하지 않습니다. 다른 브라우저의 변경은 Supabase Realtime으로 갱신됩니다.
