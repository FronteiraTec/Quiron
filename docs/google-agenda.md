# Integração com o Google Agenda

Cada pessoa conecta a **própria** conta Google no Perfil e passa a receber, numa
agenda separada chamada **Quiron**, os eventos que ela já enxerga na agenda do
sistema. Criou, editou ou excluiu no Quiron, muda no Google.

A integração é **opcional**: sem `GOOGLE_CLIENT_ID` no ambiente, o cartão nem
aparece na tela de Perfil e nada mais muda no sistema.

---

## 1. O que criar no Google Cloud

Este é o passo que depende de você — o código já está pronto e só espera as
credenciais. Leva uns 15 minutos.

### 1.1. Projeto e API

1. Acesse <https://console.cloud.google.com/> com a conta Google da incubadora
   (use uma conta institucional, não a pessoal de alguém — quem for dono do
   projeto controla a integração).
2. Crie um projeto, por exemplo **Quiron**.
3. Menu → **APIs e serviços** → **Biblioteca** → busque **Google Calendar API**
   → **Ativar**.

### 1.2. Tela de consentimento

Menu → **APIs e serviços** → **Tela de permissão OAuth**.

| Campo | Valor |
|---|---|
| Tipo de usuário | **Externo**, a menos que todos usem Google Workspace da mesma organização — nesse caso, **Interno**, que dispensa a verificação |
| Nome do app | Quiron |
| Email de suporte | um email da incubadora |
| Domínio autorizado | seu domínio (ex.: `suaincubadora.com`) |

Em **Escopos**, adicione **apenas**:

```
https://www.googleapis.com/auth/calendar.app.created
openid
email
```

> **Por que só esse escopo de calendário.** O `calendar.app.created` dá acesso
> total aos calendários que *este app criou*, e a nenhum outro. O Quiron não
> consegue ler os compromissos pessoais de ninguém — ele só escreve na camada
> "Quiron" que ele mesmo criou. O escopo mais comum (`calendar.events`) daria
> acesso a **todos** os eventos de **todos** os calendários da pessoa.

> **Se o Console recusar o escopo** com *"o nome do escopo inserido é inválido
> ou se refere a um escopo mais recente que está fora do domínio desta API
> legada"*, o nome não está errado — o `calendar.app.created` está catalogado na
> [página oficial de escopos](https://developers.google.com/identity/protocols/oauth2/scopes).
> Quem recusa é o validador da caixa de **entrada manual**, que roda contra um
> catálogo antigo e só resolve escopos de APIs **já ativadas no projeto**.
> Na ordem:
>
> 1. Ative a **Google Calendar API** (passo 1.1) — é a causa mais comum;
> 2. volte aos escopos e **selecione da lista** (filtre por `calendar.app.created`)
>    em vez de digitar na caixa manual;
> 3. se o Console já tiver migrado para o **Google Auth Platform**, os escopos
>    saíram da "Tela de permissão OAuth" e agora ficam em **Acesso a dados**;
> 4. persistindo, use a alternativa da seção 2.1 — sem tocar em código.

Enquanto o app estiver em **Teste**, só os emails cadastrados em **Usuários de
teste** conseguem conectar (limite de 100), e a autorização expira a cada 7
dias. Para uso real, clique em **Publicar app**.

### 1.3. Credencial

Menu → **APIs e serviços** → **Credenciais** → **Criar credenciais** →
**ID do cliente OAuth** → tipo **Aplicativo da Web**.

Em **URIs de redirecionamento autorizados**, informe exatamente o endereço em
que o Quiron responde:

| Ambiente | URI |
|---|---|
| Desenvolvimento | `http://localhost/api/google-agenda/callback` |
| Produção | `https://SEU-DOMINIO/api/google-agenda/callback` |

> O Google compara essa URI **byte a byte**. Uma barra a mais, `http` no lugar
> de `https` ou a porta faltando produzem `redirect_uri_mismatch` na hora de
> conectar. Pode cadastrar as duas linhas no mesmo cliente.

Copie o **ID do cliente** e a **Chave secreta do cliente**.

---

## 2. O que configurar no servidor

No arquivo `.env` da raiz (fora do git — veja `.env.example`):

```dotenv
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost/api/google-agenda/callback
TZ_AGENDA=America/Sao_Paulo

# Cifra os tokens do Google no banco. Gere com: openssl rand -base64 32
SECRET_KEY=
```

### 2.1. Trocar o escopo, se for preciso

O escopo de calendário é configurável — trocar é questão de ambiente, não de
editar código:

```dotenv
GOOGLE_SCOPE_CALENDAR=https://www.googleapis.com/auth/calendar.calendars https://www.googleapis.com/auth/calendar.events.owned
```

`calendar.calendars` cria a agenda secundária e `calendar.events.owned` escreve
nela ("calendários que você possui" — a nossa é um deles). Aceita vários escopos
separados por espaço.

**O custo é real:** o `events.owned` alcança os eventos das **outras** agendas
próprias da pessoa, coisa que o `app.created` não faz. Ainda assim é bem menos
que o `calendar` cheio, que lê e apaga tudo o que ela enxerga. Use só se o
Console realmente não aceitar o padrão, e depois de tentar os passos da seção
1.2.

Aplique a migração e suba o backend:

```bash
docker exec -i postgres_db psql -U admin -d incubadora < database/migrations/013_google_agenda.sql
docker compose up -d backend
```

> **Sobre a `SECRET_KEY`.** Sem ela o sistema deriva a chave do `JWT_SECRET` e
> funciona — mas os dois têm ciclos de vida diferentes. Trocar o `JWT_SECRET`
> apenas derruba as sessões; trocar a chave de cifragem torna **ilegível todo
> refresh token já gravado** e obriga cada pessoa a reconectar a agenda. Em
> produção, separe.

---

## 3. Como fica para quem usa

1. **Perfil** → cartão **Google Agenda** → *Conectar Google Agenda*.
2. A pessoa autoriza na tela do Google e volta ao Quiron.
3. O sistema cria a agenda **Quiron** na conta dela e carrega os eventos dos
   próximos 180 dias (e dos últimos 7).
4. Dali em diante, cada evento criado, editado ou excluído no Quiron muda lá.

No cartão ela ainda pode **pausar** o envio sem desconectar, **sincronizar
agora** (para fechar lacunas) e **desconectar** — o que apaga a agenda Quiron da
conta dela e revoga a autorização.

---

## 4. Decisões que valem conhecer

**A direção é única: Quiron → Google.** O que a pessoa fizer do lado do Google
(mover, apagar, renomear) não volta, e a próxima edição no Quiron sobrescreve.
A agenda da incubadora é a fonte da verdade — uma mentoria remarcada por engano
no celular de um participante não pode virar a versão oficial para os outros.

**Uma agenda separada, não a principal.** Os eventos vão para um calendário
secundário chamado "Quiron". A pessoa liga e desliga a camada inteira com um
clique, e desconectar apaga um calendário nosso em vez de garimpar eventos no
meio dos compromissos pessoais dela.

**Quem recebe o quê é exatamente quem já vê na agenda do sistema:** quem criou o
evento, os admins do tenant, e os membros e mentores das startups do público.
A regra mora num único trecho de SQL (`sqlUsuarioVeEvento`, em
`eventoRepository`) usado nas duas direções — "quais eventos vão para esta
pessoa?" e "para quem vai este evento?" — justamente para as duas respostas não
divergirem.

**Sem convidados no evento.** Cada pessoa recebe o evento na própria agenda,
criado por ela mesma. Colocar as outras como `attendees` faria o Google disparar
um convite de cada participante para todos os demais: uma mentoria de dez
pessoas viraria cem emails.

**Falha nunca derruba o evento.** O envio ao Google é efeito colateral do fato,
não parte dele — roda em segundo plano e engole o erro no log, como as
notificações por email. O Google fora do ar não impede a incubadora de criar um
evento, e a conexão quebrada de uma pessoa não afeta as demais.

**Autorização revogada desliga o envio.** Quando o Google responde
`invalid_grant`, o sistema marca a conexão e para de tentar — a tela mostra o
motivo e o botão de reconectar, que é a única coisa que resolve. Sem isso, cada
evento criado dispararia uma tentativa condenada.

---

## 5. Problemas comuns

| Sintoma | Causa |
|---|---|
| "O nome do escopo inserido é inválido... API legada" | O validador da caixa de escopo **manual** do Console só resolve escopos de APIs ativadas. Ative a Google Calendar API e selecione o escopo da **lista**. Ver o quadro na seção 1.2 |
| `invalid_scope` na hora de conectar | O escopo não chegou a ser aceito. Use a alternativa da seção 2.1 |
| `redirect_uri_mismatch` | `GOOGLE_REDIRECT_URI` diferente do cadastrado no Google Cloud. Compare caractere a caractere |
| "O Google não devolveu a autorização de longo prazo" | A conta já autorizou o app antes. Remova o acesso em <https://myaccount.google.com/permissions> e conecte de novo |
| Cartão não aparece no Perfil | `GOOGLE_CLIENT_ID` vazio ou o backend não foi reiniciado depois de editar o `.env` |
| Conexão cai após 7 dias | O app está em modo **Teste** na tela de consentimento. Publique-o |
| "Autorização do Google expirou ou foi revogada" | Normal depois de revogar o acesso ou trocar a `SECRET_KEY`. A pessoa reconecta pelo cartão |

---

## 6. Onde o código mora

| Arquivo | Papel |
|---|---|
| `database/migrations/013_google_agenda.sql` | Tabelas `google_conta` e `google_evento` |
| `backend/src/utils/googleApi.js` | Transporte: OAuth e Calendar API (sem SDK, `fetch` puro) |
| `backend/src/utils/cripto.js` | AES-256-GCM dos tokens |
| `backend/src/services/googleAgendaService.js` | Regra de negócio: conectar, sincronizar, ganchos do evento |
| `backend/src/repositories/googleAgendaRepository.js` | Acesso a dados (cifra e decifra aqui) |
| `backend/src/routes/googleAgendaRoutes.js` | Rotas — `/callback` é a única pública |
| `frontend/src/components/perfil/GoogleAgendaCard.jsx` | O cartão na tela de Perfil |
