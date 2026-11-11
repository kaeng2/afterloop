# data/ai-cache

AI 캐시 파일 자리 (T070). 앱은 `llm-cache.json`을 처음 한 번 읽어 쓴다 — 없으면 빈 캐시로 돈다.

- 파일: `llm-cache.json` = `{ "version": 1, "entries": { "<sha256 키>": { "response": …, "createdAt": "<ISO>" } } }`
- 키: `sha256(system + "\u0000" + user + "\u0000" + JSON.stringify(jsonSchema))`
- 담는 것: 키·응답·만든 시각만. 환경변수·헤더·요청 글은 담지 않는다.
- 만드는 사람: 컨트롤 타워가 병합 뒤 `npx tsx --env-file=.env scripts/ai-cache/build.ts` (자세한 것은 `reports/deploy.md`).
- 작업 세션은 이 파일을 만들지 않는다 (실제 AI 호출 금지).
