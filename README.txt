mint info EDITOR V5

이번 수정:
- 드래그 버벅임의 실제 원인 수정:
  선택할 때 요소 DOM을 다시 만드는 바람에 '보이는 요소'가 아니라 이미 제거된 요소를 끌고 있던 문제를 제거했습니다.
- 드래그 중 left/top을 계속 바꾸지 않고 GPU translate로 움직이게 변경했습니다.
- 마우스를 놓을 때만 실제 X/Y 좌표를 확정합니다.
- 캔버스 자동 확장은 300px 단위로만 발생해 드래그 중 레이아웃 계산을 크게 줄였습니다.
- 폰트 선택 시 FontFace API로 실제 폰트 파일을 직접 불러옵니다.
- 폰트가 없으면 우측 속성창에 '폰트 파일을 찾지 못했어요'가 표시됩니다.
- 공개 페이지도 동일하게 FontFace API로 폰트를 로드합니다.

SQL 필요 없음.

중요:
이 ZIP에는 폰트 파일 자체가 들어있지 않습니다.
아래 원본 파일 7개가 GitHub에서 index.html과 같은 위치에 실제로 존재해야 합니다.

Paperlogy-5Medium.ttf
Paperlogy-3Light.ttf
Jalnan2.otf
Puzzle Sans.ttf
원주체 Regular.otf
PyeongChangPeace-Bold.otf
BMJUA_ttf.ttf

GitHub에 ZIP 전체를 덮어쓴 뒤 Ctrl+F5 하세요.
