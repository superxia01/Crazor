# Claude × Codex × 人类协作开发规范

> 补充《branching-and-collaboration.md》，约束多 AI 协作者（Claude、Codex）与人类共同开发时的分工与边界。两文档冲突时以本文档为准。

## 1. 角色与职责

| 角色 | 职责 | 禁区 |
|------|------|------|
| **Claude**（无网络沙箱） | 功能分支内开发、本地 commit、写设计/交付文档 | 不 push/pull、不碰部署配置、不合并到 master/main |
| **Codex**（有网络/服务器） | 审计 Claude 分支、跑验证清单、CI、部署、master 合并 | 不直接在 Claude 的 feature 分支上改代码（见 §3） |
| **人类**（夏争/winds） | push/pull 网络代理、PR 审批、生产切换确认 | — |

## 2. 分支命名与所有权

- `feature/*`、`fix/*`：Claude 开发分支，**单写者**=Claude；
- `codex/*`：Codex 的审计/修复/部署分支，单写者=Codex；
- `docs/*`、`chore/*`：谁建谁写；
- `master`：唯一稳定主线（main 已废弃，仅保留只读；新工作一律基于 `origin/master`）。

**单写者原则**：一条分支只有一个写者。Codex 审计 Claude 的分支时，不在原分支改，而是开 `codex/<原分支名>-audited`，修复以增量 commit 呈现，便于 diff 审查（现行的 `codex/m0-collaboration-audited` 即此模式）。

## 3. 标准流转

```
Claude: origin/master ─→ feature/X ─→ commit(s) ─→ 人类 push
Codex:  feature/X ─→ codex/X-audited（审计+修复+跑验证清单）─→ PR → master
人类:   审 PR → 合并 → Codex 部署（releases+软链）→ 烟测 → 切换
```

1. Claude 开新分支前必须基于 `origin/master` 最新（人类先 `git fetch`，Claude 做任务启动检查四连：fetch 结论、status、log graph、diff origin/master）；
2. 每条 feature 分支附带 `docs/development/<分支主题>.md`：改动清单、API 契约、验证清单、已知边界——这是 Codex 审计的输入，必须随代码同 commit；
3. Codex 审计产出写回同一文档的「审计记录」小节；验证不过打回：在审计分支上提 issue 式 commit 注释，由 Claude 在原 feature 分支修复后重走；
4. 合并方向永远单向：feature → codex-audited → master。禁止 master 反向 cherry-pick 到开发分支（要同步就 merge 整个 master）。

## 4. 防混乱铁律

- **一分支一目标**，超过 ~500 行净增考虑拆分支；
- **commit 不混类型**：feat/fix/docs/chore 分开提交，conventional message；
- 分支合并后**立即删除**远端分支（人类执行 `git push origin --delete`），存活分支数保持 ≤ 5；
- 长期未合并（>1 周）的分支视为腐烂：要么 rebase 重提，要么关闭记录到 docs/audit；
- 数据库 schema 变更只允许走 `crazor-db.ts` 幂等迁移数组，**禁止两个并行分支同时加列同名表**——开发前在本文档底部「进行中分支登记表」登记占用的表；
- `.env*`、`shared/data/`、`current` 软链接、nginx：只有 Codex 部署流程可触碰。

## 5. 进行中分支登记表（合并后删行）

> M0（团队多用户改造）与 M1（事件总线+WS）已随 `codex/m0-collaboration-audited` 审计合入 master，按规则删行。
> 当前 `feature/m4-3d-office` 待审计，下一里程碑是 M2 多运行时网关。

| 分支 | 写者 | 目标 | 占用的表/模块 | 状态 |
|------|------|------|--------------|------|
| feature/m4-3d-office | Claude | 事件驱动 3D 数字员工办公室（Canvas 2D 重写，消费 M1 事件流） | web/src/components/office/**（无后端/无表变更） | 待 Codex 审计 |
