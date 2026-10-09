mint info EDITOR V7

수정:
- 폰트를 GitHub에서 직접 읽지 않고 Supabase Storage(site-fonts)에서 읽게 변경
- 관리자 페이지에 사이트 폰트 일괄 업로드 기능 추가
- 배경 이펙트 4개 설정창을 다시 펼치기/접기 가능한 형태로 변경
- 중앙 캔버스 영역을 아래로 항상 스크롤 가능하게 수정
- 캔버스 아래쪽 여유 공간 추가

설치 순서:
1. FONT_STORAGE_SETUP.sql을 Supabase SQL Editor에서 실행
2. ZIP 전체를 GitHub에 덮어쓰기
3. 관리자 페이지로 이동
4. '사이트 폰트 업로드'에서 가지고 있는 폰트 7개를 모두 선택해 업로드
5. 업로드 상태가 전부 '업로드됨'인지 확인
6. 에디터에서 Ctrl+F5

폰트 바이너리는 ZIP에 포함되어 있지 않습니다.
