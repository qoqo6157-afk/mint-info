mint info EDITOR V6

수정:
- 캔버스 요소를 눌렀는데 우측 설정창이 안 뜨던 선택 로직 수정
- 같은 요소를 다시 눌러도 설정창을 항상 다시 렌더링
- 요소 선택만으로 DOM 전체를 다시 만드는 동작 제거
- 빈 캔버스를 눌렀을 때만 선택 해제
- 설정창 내부 오류가 나도 전체 선택 기능이 죽지 않도록 안전 처리
- 폰트는 선택했을 때 실제 GitHub 파일 URL을 먼저 검사하고 로드
- 폰트 로드 실패 시 어떤 파일이 404/오류인지 설정창에 표시

SQL 필요 없음.

폰트 관련 중요:
이 ZIP에는 사용자가 업로드한 폰트 바이너리를 포함하지 않습니다.
아래 7개 파일이 GitHub 저장소에서 index.html과 같은 최상위 위치에 있어야 합니다.

Paperlogy-5Medium.ttf
Paperlogy-3Light.ttf
Jalnan2.otf
Puzzle Sans.ttf
원주체 Regular.otf
PyeongChangPeace-Bold.otf
BMJUA_ttf.ttf

ZIP 전체를 GitHub에 덮어쓰기 → Ctrl+F5.
