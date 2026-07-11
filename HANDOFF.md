---
created: 2026-07-12T07:40:00+09:00
project: agentwiki
branch: main
---

# Handoff

> 이 문서는 다음 작업 세션(사람 또는 에이전트)이 맥락을 이어받기 위한 문서다.
> 작업을 재개하면 이 문서를 읽고, 완료된 항목을 갱신하라.

## Original Request

> @openwiki/ 를 참조해서 Claude Code SDK를 사용해서 Claude 구독만으로 동작하는 cli도구 또는 claude code plugin을 제작하고 싶어.

(참조 대상: `~/Workspace/opensource/openwiki` — LangChain의 deepagents 기반 위키 생성 CLI)

## In Progress

프로젝트 스켈레톤과 설계/구현 문서까지 완료된 상태. 실제 구현(스킬 프롬프트 본문, CLI 래퍼 로직)은 아직 시작하지 않았다. 모든 commands/skills/src 파일은 TODO 스텁이다.

## Completed Steps

- [x] 브레인스토밍으로 방향 확정: 하이브리드(플러그인 + CLI), code 모드만, 출력 형식 2종(`llm-wiki` 기본 / `openwiki`)
- [x] **핵심 제약 발견**: Claude Agent SDK는 구독 인증을 정책상 금지 → 플러그인 + `claude -p` 헤드리스 래퍼 구조로 전환 (근거: docs/DESIGN.md)
- [x] 리포지토리 생성·푸시: https://github.com/roboco-io/agentwiki (public, 로컬: `~/Workspace/opensource/agentwiki`)
- [x] 스켈레톤 커밋: plugin manifest, 명령 스텁 2개, 스킬 스텁, CLI 스텁, CI 예시, tsconfig/package.json
- [x] 문서화: `docs/DESIGN.md`(아키텍처 결정), `docs/IMPLEMENTATION.md`(제약사항·컴포넌트·형식 스펙·검증 항목)

## Next Steps

- [ ] **`skills/wiki-generation/SKILL.md` 본문 작성** — openwiki의 `src/agent/prompt.ts`(425줄)의 run discipline을 Claude Code 스킬 형식으로 이식. docs/IMPLEMENTATION.md "Generation discipline" 섹션이 요구사항 목록.
- [ ] `commands/init.md`, `commands/update.md` 본문 작성 (스킬 위임 + `agentwiki.json` 메타데이터 read/write)
- [ ] 헤드리스 모드 검증: docs/IMPLEMENTATION.md의 "To verify" 체크리스트 3개 (플러그인 헤드리스 로딩 방법이 최대 리스크 — 안 되면 CLI가 프롬프트를 `-p`에 직접 인라인하는 폴백 사용)
- [ ] `src/cli.ts` 구현: claude 바이너리 감지 → `claude -p` spawn → 출력 스트리밍
- [ ] 소규모 실제 리포에서 `/agentwiki:init` E2E 테스트 (두 형식 모두)
- [ ] vitest 단위 테스트 + 링크 무결성 검사 스크립트
- [ ] npm 배포 + roboco-io 마켓플레이스 등록

## Key Context

- **절대 제약**: API 키 사용 금지. 모든 LLM 실행은 Claude Code를 통해서만 (구독 커버). Agent SDK 직접 사용 금지 — 정책 위반. 상세: docs/IMPLEMENTATION.md "Hard constraints".
- **설계 원칙**: 위키 생성 지능은 전부 플러그인(마크다운 프롬프트)에, TypeScript에는 절대 넣지 않는다. CLI는 인자 파싱 + spawn만.
- 출력 형식 결정은 사용자가 "설정 가능하게 둘 다"를 명시 선택함 (기본값 `llm-wiki`).
- personal 모드(커넥터/OAuth/스케줄러)는 스코프 아웃 확정.
- CI 인증: `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN` 시크릿 (examples/agentwiki-update.yml에 반영됨).

## Files Being Edited

없음 — 모든 변경 커밋 완료 (working tree clean 상태로 핸드오프).

- 다음에 열 파일: `skills/wiki-generation/SKILL.md` (TODO 스텁)
- 이식 소스: `~/Workspace/opensource/openwiki/src/agent/prompt.ts`

## Pending Items

- 없음. 사용자 확인 대기 사항 없음.

## Resume Cautions

- openwiki 프롬프트를 이식할 때 **connector/personal 모드 관련 지침은 제외**할 것 (스코프 아웃).
- `gh repo create`는 이미 실행됨 — 재실행 금지.
- superpowers 워크플로우 기준으로는 brainstorming 후 정식 spec 승인 → writing-plans 단계가 생략된 상태 (사용자가 "진행시켜"로 단축 지시). 본격 구현 전 superpowers:writing-plans로 구현 계획을 세우는 것을 권장.
