import { FILES_MARKER } from './complete';

/**
 * Bash completion for `choliba`, `chol`, `bunx choliba` and `bun chol:*`. `choliba setup` and the machine
 * command both install it. `choliba` and `chol` ask the `choliba` on `PATH`; `bunx` and `bun` ask the nearest
 * `node_modules/.bin/choliba`. Words are rebuilt from the line without breaking at ":", and `FILES_MARKER`
 * falls back to file names.
 */
export const COMPLETION_BASH = `# Autocomplete do choliba para \`choliba\`, \`chol\`, \`bunx choliba\` e \`bun choliba\` (gravado por \`choliba setup\` e pelo choliba da máquina).

_choliba_bin() {
    local dir="$PWD"
    while :; do
        if [[ -x "$dir/node_modules/.bin/choliba" ]]; then
            printf '%s\\n' "$dir/node_modules/.bin/choliba"
            return 0
        fi
        [[ "$dir" == / ]] && return 1
        dir="$(dirname "$dir")"
    done
}

# The choliba a bare \`choliba\` or \`chol\` would run.
_choliba_machine_bin() {
    command -v choliba
}

# The words up to the cursor, rebuilt from the line so ":" does not split them; a trailing space starts a new, empty one.
_choliba_words() {
    local line="\${COMP_LINE:0:COMP_POINT}"
    read -ra _choliba_line_words <<< "$line"
    if [[ -z "$line" || "$line" == *" " ]]; then
        _choliba_line_words+=("")
    fi
}

# The words of package.json script $2 when it runs choliba ("choliba", then its arguments), one per line;
# nothing for any other script. $1 is the workspace choliba, whose folder holds that package.json.
_choliba_script_words() {
    local root="\${1%/node_modules/.bin/choliba}"
    bun -e 'const fs = require("fs");
try {
  const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const words = String((pkg.scripts || {})[process.argv[2]] || "").split(" ").filter(Boolean);
  if (words[0] === "choliba") for (const word of words) console.log(word);
} catch {}' "$root/package.json" "$2" 2>/dev/null
}

# Completes the words after the command at index $2. $1 is the function that prints which choliba to
# ask. Any further arguments go first, as the arguments a package.json script already gives choliba.
_choliba_suggest() {
    local bin_of="$1"
    local after=$(( $2 + 1 ))
    shift 2
    local bin
    if ! bin="$("$bin_of")"; then
        compopt -o default 2>/dev/null
        COMPREPLY=()
        return 0
    fi
    local -a suggestions
    mapfile -t suggestions < <(bun "$bin" __complete "$@" "\${_choliba_line_words[@]:after}" 2>/dev/null)
    if [[ "\${suggestions[0]:-}" == "${FILES_MARKER}" ]]; then
        compopt -o default 2>/dev/null
        COMPREPLY=()
        return 0
    fi
    COMPREPLY=()
    local suggestion
    for suggestion in "\${suggestions[@]}"; do
        [[ -n "$suggestion" ]] && COMPREPLY+=("$(printf '%q' "$suggestion")")
    done
    local cur="\${_choliba_line_words[-1]}"
    if [[ "$cur" == *:* ]]; then
        local colon_prefix="\${cur%"\${cur##*:}"}"
        COMPREPLY=("\${COMPREPLY[@]#"$colon_prefix"}")
    fi
}

# choliba … and chol …, both answered by the choliba on PATH.
_choliba_complete() {
    _choliba_words
    (( \${#_choliba_line_words[@]} > 1 )) && _choliba_suggest _choliba_machine_bin 0
}

# bunx choliba …; any other bunx completes file names.
_choliba_complete_bunx() {
    _choliba_words
    if [[ "\${_choliba_line_words[1]:-}" == choliba ]] && (( \${#_choliba_line_words[@]} > 2 )); then
        _choliba_suggest _choliba_bin 1
        return 0
    fi
    compopt -o default 2>/dev/null
    COMPREPLY=()
}

# bun choliba …, bun run choliba … and bun <script> … for a package.json script that runs choliba
# (the chol:* scripts setup adds); anything else goes to the bun completion already registered (bun's
# own, or the choliba repository's), with "choliba" added to the first word inside a workspace.
_choliba_previous_bun="$(complete -p bun 2>/dev/null)"
_choliba_previous_bun="\${_choliba_previous_bun#*-F }"
_choliba_previous_bun="\${_choliba_previous_bun%% *}"
[[ "$_choliba_previous_bun" == _choliba_complete_bun ]] && _choliba_previous_bun=""

_choliba_complete_bun() {
    _choliba_words
    local at=1
    [[ "\${_choliba_line_words[1]:-}" == run ]] && at=2
    if [[ "\${_choliba_line_words[at]:-}" == choliba ]] && (( \${#_choliba_line_words[@]} > at + 1 )); then
        _choliba_suggest _choliba_bin "$at"
        return 0
    fi
    local bin
    if (( \${#_choliba_line_words[@]} > at + 1 )) && bin="$(_choliba_bin)"; then
        local -a script_words
        mapfile -t script_words < <(_choliba_script_words "$bin" "\${_choliba_line_words[at]}")
        if [[ "\${script_words[0]:-}" == choliba ]]; then
            _choliba_suggest _choliba_bin "$at" "\${script_words[@]:1}"
            return 0
        fi
    fi
    COMPREPLY=()
    if [[ -n "$_choliba_previous_bun" ]] && declare -F "$_choliba_previous_bun" >/dev/null; then
        "$_choliba_previous_bun" "$@"
    fi
    if (( \${#_choliba_line_words[@]} == at + 1 )) && [[ choliba == "\${_choliba_line_words[at]}"* ]] && _choliba_bin >/dev/null; then
        COMPREPLY+=(choliba)
    fi
}

complete -F _choliba_complete choliba
complete -F _choliba_complete chol
complete -F _choliba_complete_bunx bunx
complete -F _choliba_complete_bun bun
`;
