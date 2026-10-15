# Usar o choliba num script

> Como ler, de um script TypeScript, a pasta de trabalho, a configuração, os agentes e as skills, com as mesmas
> regras da linha de comando.

`import { choliba } from 'choliba'` dá a pasta de trabalho pronta para ler. Não é preciso descobrir a raiz, ler o
`.env` nem montar caminhos: cada membro usa as mesmas regras do `choliba` na linha de comando, e um script e a CLI
sempre dão a mesma resposta.

A API é de leitura e experimental até a versão 1.0. Para criar ou alterar alguma coisa, use os comandos
(`choliba set config`, `choliba add`).

## Exemplo

Dentro de uma pasta de trabalho (uma pasta cujo `package.json` depende de `choliba`), crie `choliba.ts`:

<!-- exemplo-instalado: choliba.ts -->

```ts
import { choliba } from 'choliba';

process.stdout.write(`raiz: ${choliba.root}\n`);
process.stdout.write(`agentes em ${choliba.agents.dir}\n`);
for (const agent of choliba.agents.list()) {
  process.stdout.write(`- ${agent.id} ${agent.version}\n`);
}
for (const skill of choliba.skills.list()) {
  process.stdout.write(`skill ${skill.name}: ${skill.description}\n`);
}
```

Rode `bun choliba.ts` de qualquer subpasta. A saída é parecida com:

```text
raiz: /home/voce/meu-workspace
agentes em /home/voce/meu-workspace/.choliba/agents
- implementer 1.0.2
- product-owner 1.3.1
- test-writer 1.1.1
skill playwright-cli: Automate browser interactions, test web pages and work with Playwright tests.
```

O teste do pacote distribuído roda esse exemplo com o Bun e confere os tipos do arquivo.

## A pasta de trabalho

`choliba.root` é a pasta mais próxima, subindo a partir da pasta atual, cujo `package.json` depende de `choliba`:

```ts
choliba.root; // '/home/voce/meu-workspace', rodando de qualquer subpasta dele
```

Nada é lido no `import`. A raiz é procurada no primeiro uso e guardada. Fora de uma pasta de trabalho, esse primeiro
uso lança `WorkspaceNotFoundError`:

```text
Nenhuma pasta de trabalho do choliba acima de /tmp: rode dentro de uma pasta cujo package.json dependa de choliba
(crie uma com `bun add choliba`).
```

Para partir de outra pasta ou usar outro ambiente, sem mexer no processo, use `openCholiba`:

```ts
import { openCholiba } from 'choliba';

const outro = openCholiba({ cwd: '/srv/outro-workspace' });
const isolado = openCholiba({ cwd: '/tmp/ws', env: { CHOL_AGENTS_DIR: 'meus/agentes' } });
isolado.agents.dir; // '/tmp/ws/meus/agentes'
```

Sem `cwd`, a busca parte da pasta atual. Sem `env`, o ambiente é o do processo.

## Configuração

`choliba.config(grupo)` lê um grupo de configuração das mesmas fontes da CLI, nesta ordem:

1. o ambiente;
2. o `.env` da raiz;
3. o padrão de cada chave.

Serve para os grupos do choliba e para os seus, declarados com
[`defineConfig`](../referencia/config.md):

```ts
import { agentsConfig } from 'choliba/agents';
import { defineConfig } from 'choliba/config';
import { sandboxConfig } from 'choliba/sandbox';

choliba.config(agentsConfig).provider; // 'auto'
choliba.config(sandboxConfig); // { mode: 'local', image: 'choliba-agent', network: 'isolated' }

const meuScript = defineConfig('meu-script', {
  retries: { env: 'MEU_RETRIES', type: 'number', description: 'tentativas', default: 3 },
});
choliba.config(meuScript).retries; // 3, ou o MEU_RETRIES do ambiente ou do .env
```

Um valor inválido lança o mesmo erro da CLI, nomeando a origem e a chave
(`.env: CHOL_SANDBOX: valor inválido ("vm"); esperava um de: local, docker.`).

`choliba.config.list()` devolve cada chave do choliba com o valor em vigor e a origem. São os dados de
`choliba list config`. Uma credencial só informa se está definida, e o valor dela fica de fora:

```ts
for (const setting of choliba.config.list()) {
  process.stdout.write(`${setting.key.address.env} = ${setting.value ?? '-'} (${setting.origin})\n`);
}
choliba.config.list().filter((setting) => setting.origin === '.env'); // só o que veio do .env
```

## Agentes

`choliba.agents.dir` é a pasta dos agentes, sempre absoluta. É `CHOL_AGENTS_DIR` (relativo à raiz) ou
`.choliba/agents`.

| Método              | Devolve                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `agents.list()`     | Cada agente que carrega, por id                                                                      |
| `agents.get(id)`    | Um agente validado. Um id desconhecido falha nomeando o `agent.yaml` procurado                       |
| `agents.skills(id)` | As skills que o agente declara, como uma execução as entrega (com as `instructions` do `agent.yaml`) |

```ts
choliba.agents.list().map((agent) => agent.id); // ['implementer', 'product-owner', 'test-writer']
choliba.agents.list().filter((agent) => agent.projectRequired);

const implementer = choliba.agents.get('implementer');
implementer.version; // '1.0.2'
implementer.supportedModels; // os modelos do agent.yaml

choliba.agents.skills('implementer'); // [{ name: 'playwright-cli', description, path, instructions }, ...]
```

Cada agente é um `AgentDefinition`, o mesmo tipo que a CLI usa, e o tipo é exportado por `choliba`.

## Skills

`choliba.skills.dir` é a pasta das skills, sempre absoluta. É `CHOL_SKILLS_DIR` ou `.choliba/skills`.

| Método             | Devolve                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `skills.list()`    | Cada subpasta com `SKILL.md`, por nome. Um `SKILL.md` sem `description` falha nomeando o arquivo |
| `skills.get(nome)` | Uma skill. Um nome desconhecido falha nomeando o `SKILL.md` procurado                            |

```ts
choliba.skills.list().map((skill) => skill.name);
choliba.skills.get('playwright-cli').path; // '…/.choliba/skills/playwright-cli/SKILL.md'
```

Cada skill é um `SkillSummary` (`name`, `description`, `path`).
