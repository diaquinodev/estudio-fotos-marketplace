# Estúdio de Fotos para Marketplaces

[![CI](https://github.com/diaquinodev/estudio-fotos-marketplace/actions/workflows/ci.yml/badge.svg)](https://github.com/diaquinodev/estudio-fotos-marketplace/actions/workflows/ci.yml)

Ferramenta **interna** para uma empresa ou microempreendedor gerar fotos de produto prontas para marketplaces, com **fidelidade à peça de referência**. O usuário envia fotos reais da peça (frente e costas), escolhe modelo, cenário e tipos de tomada, e o servidor monta o prompt e chama o Gemini. Não é um SaaS: não há venda de créditos, checkout nem planos; a cota de créditos de cada usuário é definida por um administrador.

> "Ateliê Aurora" é uma marca de moda **fictícia**, usada apenas como exemplo de configuração (`src/config/brand.ts`). Qualquer semelhança com marcas reais é coincidência.

## O problema (relato do autor)

> **Relato do autor (Diego Aquino).** Narrativa do autor sobre o contexto de origem; não é verificável pelo código e não traz métricas. O cliente foi ficcionalizado.

Um cliente do ramo de marketplace tinha como maior gargalo operacional a geração de imagens para e-commerce e marketplaces: a tarefa consumia horas do dia dos colaboradores, que não sabiam escrever prompts eficazes, e o resultado era inconsistente. O autor construiu esta ferramenta para gerar fotos específicas para marketplace, fiéis a uma peça de referência, com modelo e cenário personalizáveis, sem que o usuário precise escrever prompts do zero.

## Funcionalidades (verificadas)

Cada item abaixo tem código correspondente e, quando indicado, teste automatizado.

- **Login com Supabase Auth** (e-mail/senha e Google OAuth); o middleware (`src/proxy.ts`) redireciona não autenticados para `/login` (verificado subindo o build: `/` responde 307 para `/login`, `/api/generate` responde 401 sem sessão).
- **Estúdio em 3 etapas**: envio da referência → configuração de estilo → catálogo gerado (`src/app/page.tsx`, `src/components/studio/*`).
- **Modos de apresentação**: modelo humana, manequim invisível (*ghost mannequin*) e kit (2–4 modelos com cores diferentes).
- **Prompt builder**: parâmetros tipados (modelo, tecido, peça, estilização, cenário, prompt adicional, JSON de "alta fidelidade") viram um prompt estruturado no servidor (`src/services/promptBuilder.ts`; 19 testes).
- **Tipos de tomada**: 10 definidos em `SHOT_TYPES` (capa de marketplace, costas, macro de textura, lifestyle, etc.); geração de 1, 3 ou 10 fotos por sessão.
- **Presets de cenário**: 5 presets (praia, resort, urbano, minimalista, estúdio branco).
- **Bloqueio de conformidade de marketplace** na tomada de capa (sem óculos, chapéu ou bolsa; fundo neutro) — coberto por teste.
- **Retoque** de uma imagem gerada por instrução de texto (`mode: "edit"` em `/api/generate`; testado).
- **Cota de créditos**: 1 crédito = 1 imagem. O débito é **atômico e feito antes** da geração, com **estorno** se ela falhar (testado em Postgres real, inclusive com 12 requisições concorrentes disputando 3 créditos).
- **Limite de requisições por usuário**: máximo de reservas por minuto (`RATE_LIMIT_PER_MINUTE`, padrão 20), aplicado dentro da própria função SQL.
- **Galeria persistente**: cada imagem entregue é gravada no Supabase Storage (bucket privado) e registrada em `generations`; a galeria lê a tabela e exibe as imagens com URLs assinadas.
- **Otimização de imagens no navegador** antes do envio (máx. 1600 px, WebP, correção de orientação EXIF) e **sessão do estúdio persistida em IndexedDB**.
- **Erros claros**: falha do Gemini (429, bloqueio de segurança, resposta sem imagem, timeout) devolve erro explícito, sem imagem substituta e sem cobrança.

## Arquitetura

```mermaid
flowchart LR
  U[Navegador<br/>Next.js App Router] -->|login e-mail/senha ou Google| SA[Supabase Auth]
  U -->|POST /api/generate<br/>fotos de referência + parâmetros| G[/api/generate<br/>Route Handler/]
  U -->|leitura com RLS<br/>profiles, generations| DB[(Supabase Postgres)]
  U -->|URLs assinadas| ST[(Supabase Storage<br/>bucket privado)]

  G -->|getUser via cookies SSR| SA
  G -->|1 reserve_credit<br/>débito atômico + limite/min| DB
  G -->|2 prompt + imagens<br/>gemini-2.5-flash-image| GM[Google Gemini]
  GM -->|imagem| G
  G -->|3a sucesso: grava arquivo| ST
  G -->|3a sucesso: registra generations<br/>e commit_reservation| DB
  G -->|3b falha: refund_reservation| DB
  G -->|imagem + saldo restante| U
```

Fluxo de `/api/generate` (`src/app/api/generate/route.ts`):

1. Autentica o usuário e valida o payload (tipo e tamanho das Data URLs).
2. `reserve_credit` (service role): trava a linha do perfil, confere o limite por minuto e o saldo, debita e cria a reserva. Sem saldo → `403 INSUFFICIENT_CREDITS`; acima do limite → `429 RATE_LIMITED`.
3. Chama o Gemini (até 2 novas tentativas com backoff em 429/503).
4. Sucesso → grava a imagem no Storage + linha em `generations`, `commit_reservation`, responde com a imagem e o saldo restante. Falha → `refund_reservation` (idempotente) e erro claro.
5. Se apenas a persistência falhar, a imagem já gerada é entregue com `persisted: false` (não se perde nem se cobra de novo).

## Stack

- Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, lucide-react
- Supabase: Auth, Postgres (RLS + funções SQL) e Storage (`@supabase/ssr`, `@supabase/supabase-js`)
- Google Gemini (`@google/genai`), modelo `gemini-2.5-flash-image`
- Vitest (testes) e ESLint 9; GitHub Actions (CI)

## Estrutura

```
src/
├─ app/
│  ├─ page.tsx               # Estúdio (assistente de 3 etapas)
│  ├─ gallery/  settings/  privacy/  login/  auth/callback/
│  └─ api/generate/          # geração e retoque (reserva → Gemini → persistência)
├─ components/               # Sidebar, Topbar e etapas do estúdio
├─ config/brand.ts           # nome da marca de exemplo e e-mail de contato (placeholders)
├─ lib/
│  ├─ credits.ts             # reserva / confirmação / estorno (orquestra as RPCs)
│  ├─ generation.ts          # validação de Data URL, leitura da resposta do Gemini, classificação de erros
│  ├─ persistence.ts         # Storage + tabela generations
│  └─ supabase-admin.ts      # cliente service role (somente servidor)
├─ services/                 # promptBuilder, estratégia de geração (cliente), IndexedDB
└─ utils/                    # supabase (client/server/middleware), imageOptimizer
supabase/
├─ migrations/               # profiles + RLS, créditos (RPCs), generations + bucket
└─ tests/stubs.sql           # substitutos de auth/storage para testar em Postgres comum
tests/                       # rota /api/generate (mocks) e migrações (Postgres real)
```

## Variáveis de ambiente

Somente nomes; os valores ficam fora do repositório (modelo em [`.env.example`](.env.example)).

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | Somente servidor: reserva de créditos e gravação das imagens |
| `GEMINI_API_KEY` | Somente servidor |
| `RATE_LIMIT_PER_MINUTE` | Opcional. Gerações por usuário por minuto (padrão 20) |
| `MOCK_GENERATION` | Opcional. `true` devolve um placeholder local sem chamar o Gemini e sem debitar; **ignorado em produção** |

## Como rodar

Pré-requisitos: Node.js 22+ (o CI usa 22; o Node 20 funciona com avisos), um projeto Supabase e uma chave da API do Gemini.

```bash
npm install
cp .env.example .env.local        # preencha os valores
# aplique as migrações no projeto Supabase (SQL Editor ou `supabase db push`), na ordem:
#   supabase/migrations/*.sql
npm run dev                        # http://localhost:3000
```

Verificações:

```bash
npm run lint
npm run typecheck
npm test                           # unitários + rota; as migrações só rodam com TEST_DATABASE_URL
TEST_DATABASE_URL=postgres://usuario:senha@localhost:5432/banco_descartavel npm test   # inclui as migrações (usa um banco DESCARTÁVEL)
npm run build                      # exige apenas as variáveis públicas do Supabase (valores fictícios bastam)
```

Administração da cota (não há tela de administração; ver limitações). Novos usuários recebem 3 créditos (valor definido na migração `20260929120000_profiles.sql`). No SQL Editor do Supabase:

```sql
update public.profiles set credits = credits + 20 where email = 'usuario@exemplo.com.br';   -- soma 20 créditos
update public.profiles set role = 'admin' where email = 'admin@exemplo.com.br';
```

A função `public.admin_grant_credits(user_id, delta)` faz o mesmo ajuste via RPC e só aceita chamadas de um usuário com `role = 'admin'` ou do service role (o teste de migração cobre o caso de usuário comum negado e de admin permitido).

## Decisões técnicas

- **Reserva → confirmação/estorno** em vez de "debitar depois": impede gastar acima do saldo em requisições concorrentes; o estorno é idempotente e há `refund_stale_reservations` para reservas presas (ex.: o servidor caiu no meio da geração).
- **Atomicidade no banco**: a serialização vem do `SELECT … FOR UPDATE` no perfil dentro de `reserve_credit`; o código TypeScript (`src/lib/credits.ts`) só orquestra.
- **Sem mock silencioso**: a geração simulada exige flag explícita, não roda em produção, não debita e devolve um SVG local claramente rotulado.
- **RLS por padrão**: o cliente autenticado só lê o próprio perfil e as próprias gerações; saldo, reservas e inserção em `generations` só pelo service role. As funções de saldo têm `EXECUTE` revogado de `anon`/`authenticated`.
- **Chave do Gemini só no servidor** (`GEMINI_API_KEY`); a antiga janela que guardava uma chave no `localStorage` foi removida.
- **Prompt como código**: regras de fidelidade (fotos de referência como "fonte absoluta"), completar o look com peças neutras e bloqueio de conformidade para a capa, com testes.
- **Strategy Pattern** no cliente para provedores de geração (hoje só o Gemini via `/api/generate`).

## Limitações e próximos passos

- **Fidelidade à peça é apenas instrução de prompt**: não há verificação automática da imagem gerada contra a referência.
- **Sem tela de administração**: a cota é ajustada por SQL/RPC. Uma tela protegida por `role = 'admin'` é o próximo passo natural.
- **`refund_stale_reservations` não está agendada**: é preciso chamá-la periodicamente (por exemplo, `pg_cron` ou uma rotina externa).
- **Geração síncrona, uma imagem por requisição**: sem fila; o payload trafega em base64. O limite por minuto conta reservas por usuário, não é um rate limit global por IP.
- **Sem testes de interface/E2E**: os testes cobrem prompt builder, lógica de créditos, rota de geração (com mocks do Supabase e do Gemini), persistência e migrações. A chamada real ao Gemini e o fluxo completo no navegador **não foram exercitados** neste repositório.
- **Migrações validadas em PostgreSQL comum** com substitutos mínimos de `auth`/`storage` (`supabase/tests/stubs.sql`); não foram aplicadas em um projeto Supabase real.
- **Sessão do estúdio no IndexedDB** guarda as fotos de referência em Data URL no navegador (pode ser pesado) e permanece após o logout no mesmo navegador.
- **Aviso de privacidade** é um modelo curto de exemplo; revise com o responsável jurídico antes de usar.
- Avisos de ESLint restantes: uso de `<img>` (imagens em Data URL/URL assinada).

## Capturas de tela

Só a tela de login pôde ser capturada de forma automática, porque as demais exigem uma sessão do Supabase:

![Tela de login](docs/screenshots/login.png)

> As telas do estúdio e da galeria não têm captura neste repositório (é preciso um projeto Supabase e uma chave do Gemini configurados).

## Licença

Não definida. Uso e reutilização dependem de autorização do autor.
