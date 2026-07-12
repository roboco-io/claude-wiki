---
created: 2026-07-12T07:40:00+09:00
project: claude-wiki
branch: main
---

# Handoff

> 이 문서는 다음 작업 세션(사람 또는 에이전트)이 맥락을 이어받기 위한 문서다.
> 작업을 재개하면 이 문서를 읽고, 완료된 항목을 갱신하라.

## Original Request

> @openwiki/ 를 참조해서 Claude Code SDK를 사용해서 Claude 구독만으로 동작하는 cli도구 또는 claude code plugin을 제작하고 싶어.

(참조 대상: `~/Workspace/opensource/openwiki` — LangChain의 deepagents 기반 위키 생성 CLI)

## In Progress

v0.1 구현 완료: SKILL.md, 명령 2개, `dist`-buildable CLI, 링크 체커, 22 유닛 테스트, 헤드리스 E2E(두 형식) + 인터랙티브 플러그인 E2E 검증 완료. npm 퍼블리시 완료: `claude-wiki@0.2.0`. (경위: 최초 이름 `agentwiki`는 기존 `agent-wiki`와 유사명이라 npm이 403 거부 → 패키지명을 `claude-wiki`로 변경해 0.1.0 퍼블리시 → 직후 사용자 결정으로 CLI bin·리포명·플러그인명·메타데이터 파일명까지 전부 `claude-wiki`로 통일하고 0.2.0 재퍼블리시, 0.1.0은 deprecate.) roboco-io 마켓플레이스 등록 완료(2026-07-13, roboco-io/plugins의 marketplace.json에 github 소스로 등록, `claude plugin install claude-wiki@roboco-plugins` 설치 검증 통과). 스코프 내 남은 작업 없음.

## Completed Steps

- [x] 브레인스토밍으로 방향 확정: 하이브리드(플러그인 + CLI), code 모드만, 출력 형식 2종(`llm-wiki` 기본 / `openwiki`)
- [x] **핵심 제약 발견**: Claude Agent SDK는 구독 인증을 정책상 금지 → 플러그인 + `claude -p` 헤드리스 래퍼 구조로 전환 (근거: docs/DESIGN.md)
- [x] 리포지토리 생성·푸시: https://github.com/roboco-io/claude-wiki (public, 로컬: `~/Workspace/opensource/claude-wiki`)
- [x] 스켈레톤 커밋: plugin manifest, 명령 스텁 2개, 스킬 스텁, CLI 스텁, CI 예시, tsconfig/package.json
- [x] 문서화: `docs/DESIGN.md`(아키텍처 결정), `docs/IMPLEMENTATION.md`(제약사항·컴포넌트·형식 스펙·검증 항목)
- [x] **`skills/wiki-generation/SKILL.md` 본문 작성** — run discipline, git discipline, 두 형식의 경로/레이아웃 차이, init/update 모드별 워크플로, `claude-wiki.json` 스키마.
- [x] `commands/init.md`, `commands/update.md` 본문 작성 (스킬 위임 + 포맷 인자 파싱)
- [x] `src/cli.ts` 구현: `args.ts`(파싱) + `headless.ts`(claude 바이너리 감지 → `claude -p` spawn, `stdio: inherit`) + `cli.ts`(엔트리)
- [x] vitest 단위 테스트(19개, `args`/`headless`/`check-links`) + `scripts/check-links.mjs` 링크 무결성 검사 스크립트
- [x] **헤드리스 E2E 검증** (Task 7): `node dist/cli.js init`(llm-wiki, this repo 대상) → `wiki/index.md` + 3페이지 + `claude-wiki.json`(format/HEAD sha 정확) 생성, `check-links.mjs wiki` → `OK`. `node dist/cli.js update` → 변경 없음 no-op 정확히 감지, 메타데이터 타임스탬프만 갱신. `--format openwiki` → `openwiki/quickstart.md` + 2페이지 + 메타데이터 생성(소규모 리포라 스킬 규칙대로 section dir 없이 flat 구성, 의도된 동작). 생성물은 검증 후 삭제(레포에 커밋 안 함).
- [x] README 사용법 섹션 작성(설치, 명령어, `--format`, 헤드리스/CI, `claude-wiki.json` 계약, no-API-key 설계)
- [x] **check-links 코드스팬 무시 기능**: 인라인 코드와 펜스드 블록을 사전 스트립하여 위키링크 정규식이 코드 예시를 오인하지 않도록 수정 (commit 03dfadd, 회귀 테스트 3개 추가, 22/22 통과)

## Next Steps

- [x] **인터랙티브 플러그인 E2E** (2026-07-12, tmux로 실제 인터랙티브 세션 구동): `claude --plugin-dir <repo>` 세션에서 `/claude-wiki:` 자동완성에 `init`/`update` 표시 확인, `/claude-wiki:init` 실행(~3분) → 소규모 대상 리포에 `wiki/index.md` + `claude-wiki.json`(version 1, format llm-wiki, lastRunCommit=HEAD) 생성, `_plan.md` 없음, check-links `OK`, 소스 파일 무변경. 참고: acceptEdits 모드에서도 Bash(rg/git, rm/printf) 권한 프롬프트 2회 발생(정상 — acceptEdits는 파일 편집만 자동 승인).
- [x] npm 배포: `claude-wiki@0.1.0` (2026-07-13). 격리 prefix 글로벌 설치 스모크 테스트 통과(`claude-wiki --help`, invalid format exit 2, 설치 레이아웃에서 SKILL.md 해석 정상)
- [x] roboco-io 마켓플레이스 등록

## Key Context

- **절대 제약**: API 키 사용 금지. 모든 LLM 실행은 Claude Code를 통해서만 (구독 커버). Agent SDK 직접 사용 금지 — 정책 위반. 상세: docs/IMPLEMENTATION.md "Hard constraints".
- **설계 원칙**: 위키 생성 지능은 전부 플러그인(마크다운 프롬프트)에, TypeScript에는 절대 넣지 않는다. CLI는 인자 파싱 + spawn만.
- 출력 형식 결정은 사용자가 "설정 가능하게 둘 다"를 명시 선택함 (기본값 `llm-wiki`).
- personal 모드(커넥터/OAuth/스케줄러)는 스코프 아웃 확정.
- CI 인증: `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN` 시크릿 (examples/claude-wiki-update.yml에 반영됨).

## Files Being Edited

없음 — 모든 변경 커밋 완료 (working tree clean 상태로 핸드오프). Task 7의 E2E 산출물(`wiki/`, `openwiki/`)은 검증 후 삭제했으며 커밋되지 않았다.

## Pending Items

없음 — 모든 스코프 아이템이 완료되었다. (check-links 코드스팬 무시 기능은 Task 7 이후 commit 03dfadd에서 해결됨.)

## Resume Cautions

- `gh repo create`는 이미 실행됨 — 재실행 금지.
