# Onde o Choliba ainda não segue as regras

Achado em 2026-11-23 e revisto em 2026-11-25, lendo `references/clig-checklist.md` contra o código da `develop`. Atualize este arquivo quando
uma lacuna fechar ou aparecer outra; apague a linha, não a marque como feita. Um desvio de propósito não é lacuna: está
em `SKILL.md`, "Onde o Choliba se afasta do clig.dev".

| Regra | Hoje | Onde |
| --- | --- | --- |
| 5. nomes padrão | O `clear` e o `scripts/issue.ts` chamam a simulação de `--dry`, e não de `--dry-run` | `src/cli/clear.ts`, `scripts/issue.ts` |
| 5. nomes padrão | Não há `--version`: `choliba --version` cai na recusa de comando desconhecido, com código 1 | `bin/choliba.ts` |
| 6. cor e TTY | Não há uma decisão central de cor (`NO_COLOR`, `--no-color`, `TERM=dumb`); só o `isTTY` do stdout é consultado | `src/output/stdio.ts` |
| 7. `--no-input` | Nenhum comando aceita; as perguntas dependem do TTY | `src/interaction`, `src/cli/` |
| Saída: `--json`, `--quiet` | Nenhum comando tem | `src/cli/` |
| 16. comando desconhecido | A recusa lista a ajuda geral, mas não sugere o nome mais próximo ("Você quis dizer…?") | `bin/choliba.ts` |

O que já segue as regras, para referência: ajuda em português gerada da declaração (`helpText`), `-h`/`--help` por
comando, `signal` abortado no Ctrl+C, erros de uso como `UsageError`, todo comando escrevendo pelo `output`, nenhum
`console` no código (o lint recusa) e a saída de uma opção ou comando desconhecido com código 1.
