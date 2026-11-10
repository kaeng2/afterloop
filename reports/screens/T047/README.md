# T047 화면 공용 뼈대 — 스크린샷 (병합 전 확인용)

찍은 대상: `lane/ui` 커밋 `453812b` (main에 병합하지 않은 상태). 개발 서버(`next dev`)로 띄워 헤드리스 Chrome으로 찍었다. 오른쪽 아래의 동그란 "N"은 Next.js 개발 서버 표시이고 배포 화면에는 없다.

| 파일 | 폭 × 높이 | 모드 |
|---|---|---|
| `desktop-1440-light.png` | 1440 × 900 | 밝은 모드 |
| `desktop-1440-dark.png` | 1440 × 900 | 어두운 모드 (`prefers-color-scheme: dark`) |
| `narrow-390-light.png` | 390 × 844 | 밝은 모드 |
| `narrow-390-dark.png` | 390 × 844 | 어두운 모드 |

## 아직 없는 것
- **배지가 보이는 화면**: 이 커밋에는 배지를 그리는 화면이 없다 (배지 부품만 있다). 그리고 `cached` 배지는 아직 만들지 않았다 (지금 있는 것: Demo data / Assumption / AI suggests / Code decides / 위험 구간 3종). 보완 작업 뒤 `badges-*.png`를 추가한다.

## 눈에 띈 것 (컨트롤 타워 메모)
- 좁은 폭(390)에서 "This screen is not built yet." 상자가 오른쪽 끝에서 잘린다.
- 본문 아래에 메뉴와 같은 목록이 점 목록으로 한 번 더 나오고, 점이 왼쪽 여백 밖에 붙어 있다.
