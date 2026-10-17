**Versão atual: `0.0.1-dev.62+27dbedb`**, de 2026-10-15. O `choliba-0.0.1-dev.tgz` em **Assets**, no fim
da página, é desta versão.

Pré-release atualizada a cada merge na `master`; o endereço de instalação não muda e traz sempre a versão atual:

```
bun add --trust https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

A versão instalada (`bunx choliba --version`) é a do título de cada atualização abaixo.

## 2026-10-15

### [0.0.1-dev.62+27dbedb](https://github.com/choliba/choliba/pull/207) (#207)

Um script agora lê o choliba com `import { choliba } from 'choliba'`: a pasta de trabalho, a configuração, os agentes, as skills e os projetos com seus tickets e specs. As respostas seguem as mesmas regras da linha de comando. O guia "Usar o choliba num script" mostra cada método com exemplos.

#### Novidades
* `choliba`
  * [#206](https://github.com/choliba/choliba/pull/206) add projects, tickets and tests to the facade ([3bf0e46](https://github.com/choliba/choliba/commit/3bf0e46c3573809eb28efdbbab66d13dfd68540a))
  * [#205](https://github.com/choliba/choliba/pull/205) add the choliba facade for root, config, agents and skills ([36f189c](https://github.com/choliba/choliba/commit/36f189c40479e7c97568c5bd1880b89c1aba6b00))

**Commits:** [`787a582...27dbedb`](https://github.com/choliba/choliba/compare/787a582f7e5bb603c1485c138c2814915e39b006...27dbedbb4a60bf83cb8607786acb5c3f04e212ac)

### [0.0.1-dev.61+787a582](https://github.com/choliba/choliba/pull/204) (#204)

O pacote instalado ganha `choliba/config`, para declarar e ler configuração em grupos tipados, e traz o guia de uso de `choliba/core` ao lado da biblioteca. Quem importava de `choliba/core` nomes de pastas e arquivos, como `AGENT_FILE` e `CHOLIBA_DIR`, passa a importá-los de `choliba/agents` ou de `choliba/projects`.

#### Novidades
* `config`
  * [#201](https://github.com/choliba/choliba/pull/201) add the config package with sources, formats and groups ([a107f45](https://github.com/choliba/choliba/commit/a107f4598934a03a478c7a32eb97b054d560f2cd))

#### Alterações
* `core`
  * **Breaking:** [#203](https://github.com/choliba/choliba/pull/203) move the workspace layout names to their owner packages ([eaeda3a](https://github.com/choliba/choliba/commit/eaeda3a7d9f637f2c0cc4c85f7204828f16aa1be))
    > AGENT_FILE, SKILL_FILE, ENV_FILE, CHOLIBA_DIR and the other workspace layout names are no longer exported by choliba/core. Import them from choliba/agents, choliba/projects or the application setup.

#### Documentação
* `core`
  * [#200](https://github.com/choliba/choliba/pull/200) add a usage guide for the core package ([2d561b1](https://github.com/choliba/choliba/commit/2d561b10a4d55c2230d554decb853547a596db9d))

<details>
<summary>Interno: refatoração (1)</summary>

#### Refatoração
* `config`
  * [#202](https://github.com/choliba/choliba/pull/202) move workspace configuration to package groups ([70b12bc](https://github.com/choliba/choliba/commit/70b12bc8ea8aa879d8a52f8743e270188bfb4f2f))

</details>

**Commits:** [`c4d4ca7...787a582`](https://github.com/choliba/choliba/compare/c4d4ca72c1c0a1fef828bf6cc6160edb91cf18d4...787a582f7e5bb603c1485c138c2814915e39b006)

<details>
<summary>2026-10-14 · 0.0.1-dev.56 a 0.0.1-dev.60</summary>

### [0.0.1-dev.60+c4d4ca7](https://github.com/choliba/choliba/pull/199) (#199)

Dentro do sandbox (docker ou local), `bunx choliba run tests` não sai mais com 1 depois de os testes passarem. A limpeza final tentava apagar pastas no pacote instalado, que no sandbox é só de leitura.

#### Correções
* `runner`
  * [#198](https://github.com/choliba/choliba/pull/198) clean up only the playwright folders that exist ([9a89728](https://github.com/choliba/choliba/commit/9a89728c0631b953f5a38c474076145dce56d991))

**Commits:** [`abf3fb3...c4d4ca7`](https://github.com/choliba/choliba/compare/abf3fb3cc8e08b13e0c583c0bb7bdaa65146ecd6...c4d4ca72c1c0a1fef828bf6cc6160edb91cf18d4)

