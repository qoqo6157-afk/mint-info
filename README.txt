mint info WIDGETS V1

추가된 위젯:
- D-Day
- 방문자 수
- 좋아요
- 방명록
- 취향 태그
- 성향표
- 메신저/채팅 로그
- 이웃/배너 교환

추가 설정:
- 내 사이트 이름
- 내 사이트 설명
- 내 사이트 배너 이미지
- Mint Info 사용자 링크를 이웃 위젯에 넣으면 닉네임/배너 자동 인식
- 외부 사이트는 이름/배너를 직접 수정 가능

적용 순서:
1. WIDGETS_SETUP.sql을 Supabase SQL Editor에서 전체 실행
2. ZIP 전체를 GitHub에 덮어쓰기
3. Ctrl+F5
4. 편집기 왼쪽 ADD 메뉴에서 위젯 추가

참고:
GitHub Pages에서는 Discord/Kakao 등의 링크 미리보기 OG 이미지를 사용자별로 동적으로 바꾸기 어렵습니다.
이번 버전은 사용자별 배너 데이터를 저장해 이웃 자동 인식에 사용합니다.
나중에 Cloudflare Pages/Vercel로 옮기면 같은 배너 데이터를 OG 이미지에도 연결할 수 있습니다.
