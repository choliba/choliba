#!/usr/bin/env bash

# Carrega a autocompletação nativa do Bun
if command -v bun &>/dev/null; then
    eval "$(bun completions 2>/dev/null)"
fi

# Lista os scripts do package.json do diretório atual, separados por espaço
_bun_monorepo_scripts() {
    [[ -f "package.json" ]] || return 0
    bun -e '
        try {
            const pkg = require("./package.json");
            if (pkg.scripts) {
                console.log(Object.keys(pkg.scripts).join(" "));
            }
        } catch (e) {}
    ' 2>/dev/null
}

# Segue a cadeia de um script do package.json até o CLI que ele roda. Ex.: "chol:docs" -> "bun chol:agents
# --docs-updater" -> "chol:agents" -> "bun packages/agents/src/cli/main.ts". Imprime o arquivo do CLI na
# primeira linha e os argumentos fixos (--docs-updater) nas seguintes. Só imprime algo se o
# package.json do pacote dono do arquivo tiver "cholCompletion": true, ou seja, se o CLI responde a
# "__complete"; qualquer outro script (prettier, jest, scripts/git-clean.ts) nunca é executado.
_bun_monorepo_resolve_cli() {
    CHOL_COMPLETION_SCRIPT="$1" bun -e '
        const fs = require("fs");
        const path = require("path");
        try {
            const scripts = require("./package.json").scripts ?? {};
            let tokens = (scripts[process.env.CHOL_COMPLETION_SCRIPT] ?? "").trim().split(/\s+/);
            for (let hop = 0; hop < 10; hop++) {
                if (tokens[0] === "bun") tokens.shift();
                if (tokens[0] === "run") tokens.shift();
                const [head, ...rest] = tokens;
                if (head === undefined) break;
                if (scripts[head] !== undefined) {
                    tokens = [...scripts[head].trim().split(/\s+/), ...rest];
                    continue;
                }
                if (!/\.[cm]?[jt]s$/.test(head) || !fs.existsSync(head)) break;
                let dir = path.dirname(path.resolve(head));
                while (!fs.existsSync(path.join(dir, "package.json"))) dir = path.dirname(dir);
                if (require(path.join(dir, "package.json")).cholCompletion === true) {
                    console.log([head, ...rest].join("\n"));
                }
                break;
            }
        } catch (e) {}
    ' 2>/dev/null
}

# Completa "$cur" com as opções dadas. O bash quebra palavras em ":" (COMP_WORDBREAKS) e só
# substitui o pedaço depois do último ":", então esse prefixo sai de cada sugestão.
_bun_monorepo_compreply() {
    local options="$1" cur="$2"
    COMPREPLY=( $(compgen -W "$options" -- "$cur") )
    _bun_monorepo_trim_colon "$cur"
}

_bun_monorepo_trim_colon() {
    local cur="$1"
    if [[ "$cur" == *:* ]]; then
        local colon_prefix="${cur%"${cur##*:}"}"
        COMPREPLY=( "${COMPREPLY[@]#"$colon_prefix"}" )
    fi
}

# Argumentos depois do nome de um script: pergunta ao próprio CLI ("__complete") o que sugerir.
# Script que não é um CLI do repo, ou CLI que pede arquivos (":files"), completa nomes de arquivo.
_bun_monorepo_complete_script() {
    local script="$1"
    shift
    local -a resolved suggestions
    mapfile -t resolved < <(_bun_monorepo_resolve_cli "$script")
    if (( ${#resolved[@]} == 0 )); then
        compopt -o default 2>/dev/null
        COMPREPLY=()
        return 0
    fi

    mapfile -t suggestions < <(bun "${resolved[0]}" __complete "${resolved[@]:1}" "$@" 2>/dev/null)
    if [[ "${suggestions[0]:-}" == ":files" ]]; then
        compopt -o default 2>/dev/null
        COMPREPLY=()
        return 0
    fi

    COMPREPLY=()
    local suggestion
    for suggestion in "${suggestions[@]}"; do
        [[ -n "$suggestion" ]] && COMPREPLY+=( "$(printf '%q' "$suggestion")" )
    done
    # Sugestões com ":" passam pela mesma regra do bash de quebrar palavras em ":"
    _bun_monorepo_trim_colon "${!#}"
}

_bun_complete_monorepo() {
    # Remonta as palavras a partir da linha até o cursor, sem quebrar em ":"
    # (em COMP_WORDS, "bun project:" vira "bun" "project" ":").
    local line="${COMP_LINE:0:COMP_POINT}"
    local -a words
    read -ra words <<< "$line"
    # Cursor logo após um espaço: começa uma palavra nova, vazia
    if [[ -z "$line" || "$line" == *" " ]]; then
        words+=("")
    fi
    local cword=$(( ${#words[@]} - 1 ))
    local cur="${words[cword]}"
    local prev=""
    if (( cword > 0 )); then
        prev="${words[cword-1]}"
    fi

    # Primeiro argumento após 'bun ' (ex: bun <TAB>): subcomandos nativos + scripts do package.json
    if (( cword == 1 )); then
        local native_completions=""
        if declare -f _bun_completions >/dev/null; then
            _bun_completions
            native_completions="${COMPREPLY[*]}"
        elif declare -f _bun >/dev/null; then
            _bun
            native_completions="${COMPREPLY[*]}"
        fi

        _bun_monorepo_compreply "$native_completions $(_bun_monorepo_scripts)" "$cur"
        return 0
    fi

    # Após 'bun run <TAB>': só os scripts do package.json
    if [[ "$prev" == "run" ]] && (( cword == 2 )); then
        local scripts
        scripts="$(_bun_monorepo_scripts)"
        if [[ -n "$scripts" ]]; then
            _bun_monorepo_compreply "$scripts" "$cur"
            return 0
        fi
    fi

    # Depois do nome de um script ('bun <script> ...' ou 'bun run <script> ...'): argumentos do CLI
    local script_index=1
    if [[ "${words[1]}" == "run" ]]; then
        script_index=2
    fi
    local script="${words[script_index]}"
    if (( cword > script_index )) && [[ " $(_bun_monorepo_scripts) " == *" $script "* ]]; then
        _bun_monorepo_complete_script "$script" "${words[@]:script_index+1}"
        return 0
    fi

    # Fallback para os subcomandos e argumentos nativos do Bun (ex: bun add <TAB>, bun test <TAB>)
    if declare -f _bun_completions >/dev/null; then
        _bun_completions
    elif declare -f _bun >/dev/null; then
        _bun
    fi
}

# Associa a função ao comando bun
complete -F _bun_complete_monorepo bun
