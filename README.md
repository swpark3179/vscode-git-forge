# Git Forge

고급 Git 작업을 **안전하고, 시각적이며, 되돌릴 수 있게** 제공하는 VSCode 확장입니다.
Claude Design 목업(`Git Forge.dc.html`)을 실제 git 기능으로 구현했습니다.

## 기능

액티비티바의 **Git Forge** 아이콘을 누르면 사이드바 네비게이션이 열리고, 각 항목은
에디터 영역의 Git Forge 패널에서 동작합니다.

| 기능 | 설명 |
|---|---|
| **브랜치 리포지** (대표) | 히스토리에서 특정 파일만 외과적으로 제거 (base..HEAD 재구성, 충돌 없음) |
| **커밋 재정비** | 여러 커밋 합치기(squash) · 한 커밋의 파일 분리(split) |
| **브랜치 최신화** | origin 기본 브랜치 fetch → ff-only → rebase\|merge (실시간 스트리밍) |
| **브랜치 정리** | 병합/오래된/보호 브랜치 분류 후 일괄 삭제 |
| **Reflog 복구** | HEAD 이동 이력 타임라인 + 임의 시점 복원 |
| **커밋 그래프** | 브랜치/머지 레인 시각화(SVG) + 커밋 상세 |
| **이력 검색** | 메시지·작성자·파일·코드(pickaxe `-S`) 4모드 + 하이라이트 |
| **파일 이력** | 한 파일의 모든 버전 + diff + 읽기 전용으로 열기 |

모든 파괴적 작업은 **백업 ref**(`refs/git-forge/backup/...`)를 자동 생성하고,
실행 전 **확인 대화**를 거치며, 완료 후 **되돌리기**를 제공합니다.

## 아키텍처

- **Host** (`src/`): `GitRunner`(argv-only spawn, 셸 미사용)로 시스템 git을 실행.
  RS/US + `-z` 기반 안정적 파싱(`parse.ts`), 백업/사전조건/undo(`safety.ts`),
  기능별 모듈(`git/*.ts`, `git/ops/*.ts`).
- **Webview** (`webview/`): `.dc.html` 인터프리터 대신 직접 DOM 렌더링.
  순수 함수 `buildViewModel` + 기능별 `views/*.ts`가 디자인 마크업을 그대로 포팅.
- **프로토콜** (`src/shared/protocol.ts`): 요청/응답 + 스트리밍 이벤트 타입 union.

## 개발

```bash
npm install
npm run build        # esbuild 2번들 (host: dist/extension.js, webview: dist/webview.js)
npm run watch        # 워치 모드
npm run typecheck    # tsc --noEmit
```

### 디버그 실행
1. VSCode에서 이 폴더를 연다.
2. `F5` (Run Extension) → Extension Development Host가 뜬다.
3. 그 창에서 **git 저장소가 있는 폴더**를 연다 (Desktop 등 비-저장소 폴더에서는 안내 화면이 표시됨).
4. 액티비티바의 Git Forge 아이콘 클릭.

> 전제: 시스템에 `git`이 설치되어 PATH에서 사용 가능해야 합니다.

## 패키징

```bash
npm run package      # vsce package → git-forge-0.1.0.vsix
```
# vscode-git-forge
