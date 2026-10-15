# `@choliba/config`

> Configuração tipada por grupos, com fontes ordenadas, arquivos dotenv, JSON e YAML e proteção de segredos.

## Índice

- [O que é](#o-que-é)
- [Instalar](#instalar)
- [Exemplo completo](#exemplo-completo)
- [Declarar grupos](#declarar-grupos)
- [Ler fontes e definir precedência](#ler-fontes-e-definir-precedência)
- [Formatos e conversões](#formatos-e-conversões)
- [Padrões e valores permitidos](#padrões-e-valores-permitidos)
- [Catálogo e configurações em vigor](#catálogo-e-configurações-em-vigor)
- [Segredos](#segredos)
- [Gravar configuração](#gravar-configuração)
- [API pública](#api-pública)

<!-- #region guia -->

## O que é

O `@choliba/config` é uma biblioteca independente para declarar e resolver configuração. Uma aplicação divide suas
chaves em grupos, descreve o tipo e os endereços de cada chave e escolhe uma lista ordenada de fontes. A primeira
fonte que definir uma chave vence.

O pacote não conhece chaves, pastas ou módulos do choliba. Ele pode ser usado por outra aplicação sem carregar o
shell da CLI. Também não lê arquivos ou o ambiente implicitamente: a aplicação cria as fontes e determina sua ordem.

## Instalar

O pacote vem no subcaminho `choliba/config` do artefato instalável do choliba. Você precisa do
[Bun](https://bun.sh) para instalar o `.tgz` da pre-release:

```sh
bun add https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

Importe a API por `choliba/config`:

```js
import { defineConfig, envSource, fileSource } from 'choliba/config';
```

## Exemplo completo

Este exemplo lê `name` de um `.env` e `port` de um YAML. Crie `.env`:

```dotenv
EXAMPLE_NAME=from-dotenv
```

Crie `settings.yaml`:

```yaml
server:
  port: 4321
```

Crie `config.ts`:

<!-- exemplo-instalado: config.ts -->

```ts
import { defineConfig, fileSource } from 'choliba/config';

const applicationConfig = defineConfig('application', {
  name: {
    env: 'EXAMPLE_NAME',
    type: 'string',
    description: 'Name shown by the application',
  },
  port: {
    env: 'EXAMPLE_PORT',
    path: ['server', 'port'],
    type: 'number',
    description: 'Port listened on by the application',
    default: 3000,
  },
});

const config = applicationConfig.read([fileSource('.env'), fileSource('settings.yaml')]);

process.stdout.write(`${JSON.stringify(config)}\n`);
```

Rode `bun config.ts`. A saída é:

```text
{"name":"from-dotenv","port":4321}
```

O teste do artefato distribuído roda esse exemplo com o Bun e confere os tipos do arquivo.

## Declarar grupos

`defineConfig(name, keys)` declara um grupo e devolve:

- `read(sources)`, que resolve e tipa os valores sem precisar de container;
- `token`, um token por identidade compatível estruturalmente com containers que usam `{ name, type? }`;
- `keys`, os metadados usados por catálogos, listagens e escrita.

Cada chave aceita estes campos:

| Campo         | Função                                                                      |
| ------------- | --------------------------------------------------------------------------- |
| `env`         | Nome usado por fontes planas, como ambiente e dotenv.                       |
| `path`        | Caminho usado por JSON e YAML; o padrão é `[nomeDoGrupo, nomeDaChave]`.     |
| `type`        | `string`, `number`, `boolean` ou `list`.                                    |
| `description` | Explicação para interfaces e listagens.                                     |
| `default`     | Valor fixo ou função baseada nas chaves anteriores do grupo.                |
| `values`      | Lista fechada de textos aceitos; para `list`, cada item precisa estar nela. |
| `secret`      | Quando `true`, impede que o valor apareça em listagens e mensagens de erro. |

Quando `values` usa literais, o objeto resolvido preserva essa união no TypeScript. Uma chave sem `default` também
pode resultar em `undefined`.

## Ler fontes e definir precedência

As fontes são consultadas da esquerda para a direita. A primeira que tiver um valor para a chave vence:

```js
const config = group.read([envSource(process.env, 'ambiente'), fileSource('.env'), fileSource('settings.yaml')]);
```

- `envSource(env, name?)` lê `address.env` de um objeto semelhante a `process.env` e não grava.
- `fileSource(file?, options?)` lê dotenv, JSON ou YAML. Um arquivo ausente é uma fonte vazia.
- `options.format` permite fornecer outro `ConfigFormat`; `options.name` muda o nome mostrado como origem.

O Bun pode carregar o `.env` da pasta inicial em `process.env`. Por isso, `envSource` informa que pode ecoar fontes
posteriores: se seu valor for igual ao valor de um arquivo posterior, a proveniência é atribuída ao arquivo. Se for
diferente, a origem continua sendo o ambiente.

## Formatos e conversões

`formatFor(file)` reconhece `.env` e variantes como `.env.local`, `.json`, `.yaml` e `.yml`. Os formatos também são
exportados como `dotenv`, `json` e `yaml`; `CONFIG_FORMATS` reúne os formatos nativos.

Fontes planas guardam texto, que é convertido conforme `type`. JSON e YAML precisam trazer o tipo correto:

| Tipo      | Fonte plana                              | JSON ou YAML                         |
| --------- | ---------------------------------------- | ------------------------------------ |
| `string`  | qualquer texto                           | texto                                |
| `number`  | decimal finito, como `3000`, `-1`, `0.5` | número finito                        |
| `boolean` | somente `true` ou `false`                | booleano                             |
| `list`    | itens separados por vírgula              | lista de textos, números e booleanos |

Espaços nas pontas dos itens de uma lista plana são removidos e itens vazios são descartados. Árvores rejeitam
objetos ou outras listas dentro de listas e informam o arquivo e o caminho inválido.

JSON e YAML são somente leitura. Dotenv lê e grava preservando as outras linhas do arquivo.

## Padrões e valores permitidos

Um padrão fixo é validado ao declarar o grupo. Um padrão derivado recebe apenas os valores das chaves anteriores:

```js
const paths = defineConfig('paths', {
  root: { env: 'APP_ROOT', type: 'string', description: 'Root directory' },
  data: {
    env: 'APP_DATA',
    type: 'string',
    description: 'Data directory',
    default: (previous) => (previous.root === undefined ? undefined : `${previous.root}/data`),
  },
});
```

Acessar uma chave declarada depois falha durante a resolução e nomeia o grupo e a chave. `values` restringe o valor
depois da conversão; numa lista, a restrição é aplicada a cada item.

## Catálogo e configurações em vigor

`configCatalog(groups)` reúne os grupos e suas chaves. Ele rejeita dois grupos que usem o mesmo `env` ou o mesmo
`path`, nomeando os dois donos do endereço.

`configSettings(catalog, sources)` devolve as configurações na ordem dos grupos. Cada item informa a chave, o valor
em texto, se existe um valor, sua origem e um eventual erro de conversão. Valores padrão têm origem `padrão`; chaves
sem fonte nem padrão têm origem `nenhum`.

## Segredos

Marque credenciais com `secret: true`. O valor continua disponível no objeto resolvido, mas:

- `configSettings` informa apenas que ele está definido;
- erros de conversão e de valores permitidos omitem o conteúdo recebido;
- mensagens produzidas pela escrita não expõem o valor.

A proteção vale para a apresentação feita pelo pacote. A aplicação ainda deve evitar imprimir diretamente o objeto
resolvido ou a fonte que contém o segredo.

## Gravar configuração

`writeConfig(catalog, sources, env, text)` procura a chave por `env`, converte e valida o texto e grava na primeira
fonte que implementar `write`. Depois, ele recalcula o valor efetivo e informa a fonte gravada e a configuração em
vigor.

Com `[envSource(process.env), fileSource('.env')]`, a gravação vai ao `.env`. Se o ambiente anterior ainda definir um
valor diferente, ele continua vencendo; o resultado de `writeConfig` permite que a aplicação avise isso. Se nenhuma
fonte puder gravar, a operação falha nomeando a chave e as fontes consultadas.

Neste momento somente o formato dotenv implementa escrita. JSON e YAML permanecem somente leitura.

## API pública

| Export principal                                              | Uso                                                       |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| `defineConfig`                                                | Declara e resolve um grupo tipado.                        |
| `configCatalog`                                               | Agrega grupos e detecta colisões.                         |
| `configSettings`                                              | Lista valores efetivos, origens e erros.                  |
| `writeConfig`                                                 | Valida e grava pela primeira fonte gravável.              |
| `envSource`, `fileSource`                                     | Criam as fontes nativas.                                  |
| `dotenv`, `json`, `yaml`, `CONFIG_FORMATS`, `formatFor`       | Formatos nativos e detecção pelo nome.                    |
| `configTree`                                                  | Valida uma árvore analisada como `unknown`.               |
| `ConfigGroup`, `ConfigToken`, `ConfigKey`, `ConfigCatalog`    | Tipos de grupos e catálogo.                               |
| `ConfigSource`, `ConfigFormat`, `ConfigAddress`, `ConfigTree` | Tipos para fontes e formatos próprios.                    |
| `ConfigValue`, `ConfigScalar`, `ConfigSetting`, `ConfigWrite` | Tipos dos valores, listagem e resultado de escrita.       |
| `ConfigError`                                                 | Erro esperado de declaração, leitura, formato ou escrita. |

Um formato próprio implementa `ConfigFormat` e pode ser entregue a `fileSource` por `options.format`. Uma fonte
própria implementa `ConfigSource`; sua propriedade `layout` define se a conversão parte de texto plano ou de valores
já tipados.

<!-- #endregion guia -->
