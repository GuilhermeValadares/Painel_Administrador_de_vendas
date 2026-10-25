# PRD — Painel de Vendas da Maria

Data: 2026-10-25

## 1. Problema identificado

A Maria perde tempo e confiança nos próprios dados porque anota cada venda numa planilha sem padrão e, depois, não consegue achar nada nela.

**Qual é a dor real**

- **Cada venda é digitada de memória.** A data aparece em 5 formatos (`4/8`, `2026-08-06`, `ontem`, `segunda`, vazia), o valor como `R$ 35`, `35,00` ou `35+12 frete`, e o pagamento como `credito 3x visa` numa célula só.
- **Achar uma informação é ler linha por linha.** Para saber se um pagamento caiu ou qual é o código de rastreio de uma cliente, ela rola a planilha inteira.
- **Há dados fora do lugar.** Código de rastreio e telefone aparecem na coluna "pra quem", e uma compra de estoque (R$ 200), uma devolução (`-40`) e linhas repetidas se misturam com as vendas.
- **Quem deve não tem controle.** `fiado` e `depois paga` ficam perdidos no meio das linhas.

**Consequência:** a Maria não sabe quanto vendeu no mês, quanto tem para receber nem se um pacote já foi enviado. Ela "não entende quase nada de tecnologia", então qualquer solução que exija aprender uma ferramenta nova não resolve.

**Ponto de partida:** a planilha atual tem 72 linhas e 10 colunas (data, o que vendeu, para quem, valor, como pagou, cartão, vezes, entrega ou loja, rastreio, observação).

**Restrições do desafio:** ela precisa usar sozinha, e os dados que já estão na planilha continuam com ela.

## 2. Solução

Um painel web com só duas telas, **login** e **painel de vendas**, onde a Maria registra uma venda em poucos toques, acha qualquer venda digitando uma palavra e leva os dados de volta para o Excel quando quiser.

**O que vamos construir**

Uma aplicação web responsiva (celular e computador) que substitui a planilha no dia a dia. Em vez de uma linha livre, a Maria preenche um formulário guiado, com perguntas em português simples ("O que você vendeu?", "Como pagou?"). Os dados ficam no Supabase (PostgreSQL), o acesso é protegido por Supabase Auth, e a planilha antiga entra no sistema por uma importação que conserta o que consegue e pergunta o que não tem certeza.

**Diferenciais**

- **Formulário que se adapta:** cartão e parcelas só aparecem se ela escolher crédito ou débito, e o código de rastreio só aparece se a entrega for pelos Correios.
- **O sistema lembra por ela:** ao digitar "arg", sugere "brinco argola — R$ 35" a partir do histórico, e o valor já vem preenchido.
- **Importa a planilha dela sem inventar nada:** o que é claro é padronizado, e o que é dúvida vai para uma lista "Para conferir" com uma sugestão. O texto original de cada linha é sempre guardado.
- **Fiado em destaque:** um cartão "A receber" e o botão "Já pagou" em cada venda pendente.
- **O Excel volta para ela:** um botão "Baixar planilha" gera o arquivo organizado a qualquer momento, então os dados continuam sendo dela.
- **Errou? Desfaz:** ao apagar uma venda aparece "Desfazer" por alguns segundos.
- **Método:** o projeto segue PRD, RFC e TDD com apoio de IA. Os testes do importador usam as 72 linhas reais da planilha, e as decisões em que discordei da IA ficam registradas para a apresentação.

## 3. Funcionalidades principais

São 9 funcionalidades, todas pensadas para as duas telas (login e painel).

1. Login com e-mail e senha
2. Painel com resumo (vendido hoje, no mês e a receber)
3. Registrar venda (Create)
4. Lista de vendas com busca e filtros (Read)
5. Editar venda (Update)
6. Apagar venda com "Desfazer" (Delete)
7. Controle de fiado ("Já pagou")
8. Importar a planilha da Maria
9. Baixar planilha em Excel

**Detalhamento**

- **Login:** Supabase Auth com e-mail e senha. Não existe cadastro público, porque a conta da Maria é criada por nós. A sessão dura semanas para ela não precisar entrar toda hora, e a recuperação de senha é por e-mail. Todas as rotas do painel exigem login.
- **Painel:** três cartões no topo (Vendido hoje, Vendido neste mês, A receber), um botão grande "+ Nova venda" e, abaixo, a lista das últimas vendas. As devoluções entram subtraindo do total.
- **Lista, busca e filtros:** uma única caixa de busca procura em cliente, produto, observação e código de rastreio. Atalhos de um toque: Hoje, Esta semana, Este mês, Tudo, A receber e Falta rastreio (Correios sem código).
- **Registrar e editar venda:** o mesmo formulário nos dois casos, com os campos da tabela abaixo. Ao salvar, a Maria vê "Venda salva" e a lista já atualizada.
- **Apagar:** pergunta "Tem certeza?" e depois mostra "Desfazer" por alguns segundos. A venda é marcada como apagada, não some do banco de verdade.
- **Fiado:** vendas com pagamento "Ainda não pagou" aparecem em "A receber". O botão "Já pagou" pergunta como foi pago (Pix, dinheiro, etc.) e muda a venda para paga.
- **Importar planilha:** a Maria envia o arquivo `.xlsx` dela e vê "Entendi X vendas e Y precisam da sua conferência". Ela corrige as dúvidas na própria tela e confirma. As regras estão na tabela mais abaixo.
- **Baixar planilha:** gera um `.xlsx` com as colunas conhecidas por ela (data, o que vendeu, para quem, valor, como pagou, etc.), já padronizado.

**Campos da venda**

| Campo | Pergunta na tela | Regra | Obrigatório |
| --- | --- | --- | --- |
| Data | "Quando foi?" | Vem preenchida com hoje, com botões Hoje e Ontem | Sim |
| O que vendeu | "O que você vendeu?" | Texto com sugestões do histórico | Sim |
| Cliente | "Para quem?" | Texto livre com sugestões, e a opção "Não anotei" | Não |
| Valor | "Quanto foi?" | Aceita `35` e `35,00`, maior que zero, guardado em centavos | Sim |
| Como pagou | "Como pagou?" | Botões: Pix, Dinheiro, Débito, Crédito, Ainda não pagou | Sim |
| Cartão | "Qual cartão?" | Visa, Master, Elo, Outro. Aparece só em débito e crédito | Sim, se cartão |
| Parcelas | "Em quantas vezes?" | De 1 a 12. Aparece só em crédito (débito é sempre 1) | Sim, se crédito |
| Entrega | "Como a cliente recebeu?" | Levou na hora, Veio buscar, Correios ou Motoboy | Sim |
| Rastreio | "Código de rastreio" | Aparece só em Correios. Formato de 2 letras, 9 números e 2 letras (ex.: `AA123456789BR`). Pode ser preenchido depois | Não |
| Observação | "Quer anotar algo?" | Texto livre (ex.: "pediu embrulho") | Não |
| Tipo | "É uma devolução?" | Venda (padrão) ou Devolução, que subtrai do total | Sim |

Campos internos (a Maria não vê): identificador, dono da venda, criada em, alterada em, apagada em, origem (digitada ou importada) e texto original da linha importada.

**Regras da importação**

| O que há na planilha | O que o sistema faz |
| --- | --- |
| Data em formatos misturados (`4/8`, `2026-08-06`, `8/16/26`) | Padroniza. Se ficar ambígua (`8/6/26` pode ser 8 de junho ou 6 de agosto), usa as linhas vizinhas como pista e marca "Para conferir" |
| Data escrita como `ontem`, `hj`, `segunda` ou vazia | Não dá para saber o dia: marca "Para conferir" e sugere a data da linha anterior |
| Data fora do período (`12/3`, `12 de marco`) | Marca "Para conferir" |
| Valor com `R$`, vírgula ou vazio | Converte para centavos. Vazio vai para "Para conferir" |
| `35+12 frete` | Marca "Para conferir" com sugestão: valor 35 e observação "frete R$ 12" |
| `credito 3x visa` numa célula, ou `maquinha` com parcelas | Separa em crédito, 3 vezes e Visa |
| `fiado`, `depois paga` | Vira "Ainda não pagou" e entra em "A receber" |
| Pagamento vazio com observação `pagou no pix` | Sugere Pix e marca "Para conferir" |
| Código de rastreio ou telefone na coluna "pra quem" | Move o código para Rastreio. O telefone fica como cliente |
| `loja` e `presencial` | Viram "Levou na hora" |
| `ela veio buscar` | Vira "Veio buscar" |
| `correios` e `sedex` | Viram "Correios" |
| Devolução (valor `-40`) | Vira venda do tipo Devolução |
| Compra de estoque (`comprei 20 argolas`) | Fica de fora das vendas e aparece no resumo da importação |
| Linha que parece repetida (mesma data, produto, cliente e valor) | Marca "Para conferir" |
| Linha totalmente vazia | Ignorada |

Regra geral: **o sistema nunca inventa**. Quando não tem certeza, pergunta.

## 4. Persona e tipos de usuário

O sistema tem **um único tipo de usuário, a Maria**, e cada conta só enxerga as vendas que são dela.

**Maria, dona da loja de acessórios**

- Vende brincos, colares, anéis, pulseiras e outros itens, pela loja, por Correios e por motoboy.
- Hoje anota tudo numa planilha de Excel, uma linha abaixo da outra, e às vezes esquece datas e detalhes.
- Não entende quase nada de tecnologia. A referência do desafio é pensar nela como a sua avó.
- Precisa de telas que não exijam explicação: poucas escolhas por vez, botões grandes, palavras do dia a dia.

**O que a Maria precisa fazer (e como o painel responde)**

| Tarefa | Onde resolve |
| --- | --- |
| Anotar uma venda na hora | Botão "+ Nova venda" |
| Achar o rastreio ou o pagamento de uma cliente | Caixa de busca do painel |
| Saber quem ainda não pagou | Cartão "A receber" |
| Ver quanto vendeu no mês | Cartão "Vendido neste mês" |
| Lembrar de pacotes sem código de rastreio | Atalho "Falta rastreio" |
| Levar os dados de volta para o Excel | Botão "Baixar planilha" |

**Acesso e segurança**

Não há cadastro público. A conta é criada por nós no Supabase e entregue à Maria. Cada venda guarda o dono, e o sistema filtra tudo por esse dono. A segurança no banco (Row Level Security) fica ligada como segunda barreira.

## 5. Stack tecnológica

Tudo em **Node.js e TypeScript**, num único repositório, com **Prisma** como ORM e **Supabase** (PostgreSQL e Auth) como banco e login.

**Tecnologias selecionadas**

Node.js, TypeScript, Next.js (App Router), React, Prisma, Supabase (PostgreSQL e Auth), Zod, Tailwind CSS, shadcn/ui, ExcelJS, Vitest, Vercel, Git e GitHub.

**Detalhes da stack**

| Camada | Tecnologia | Uso no projeto |
| --- | --- | --- |
| Linguagem | TypeScript em todo o código | Mesmos tipos no formulário, na validação e no banco |
| Servidor | Node.js, dentro do Next.js (Server Actions e Route Handlers) | Regras de negócio, importação e exportação. Não há backend separado |
| Interface | React com Next.js (App Router) | As duas telas: login e painel |
| Estilo e componentes | Tailwind CSS e shadcn/ui | Botões, formulários, diálogos e avisos acessíveis |
| Formulários | react-hook-form e Zod | Validação com mensagens em português, a mesma regra no navegador e no servidor |
| Banco | Supabase PostgreSQL | Tabela de vendas |
| ORM | Prisma | Schema, migrações e consultas tipadas |
| Login | Supabase Auth (`@supabase/ssr`) | E-mail e senha, sessão por cookie, proteção das rotas |
| Planilhas | ExcelJS | Lê a planilha da Maria e gera o arquivo para baixar |
| Datas | date-fns (pt-BR) | Leitura e formatação de datas |
| Testes | Vitest | TDD do importador e das regras de valor, data e pagamento |
| Deploy | Vercel, ligada ao GitHub | Publica a cada commit e gera o link para o avaliador |
| Desenvolvimento | Cursor e Claude Code, com Git e GitHub | Código escrito com apoio de IA, seguindo o PRD e o RFC |

**Decisões técnicas que importam**

- **Dinheiro em centavos (número inteiro).** Evita erros de arredondamento. A tela mostra `R$ 35,00`.
- **Prisma e Supabase juntos.** O Prisma conecta direto no PostgreSQL e, por isso, **não passa pelas regras de Row Level Security**. Por isso toda consulta no código filtra pelo dono da venda, lido da sessão já verificada no servidor. O RLS fica ligado como segunda barreira. O Supabase pede duas URLs de conexão (uma pelo pooler e outra direta para as migrações).
- **Apagar é "marcar como apagado".** Isso permite o "Desfazer".
- **Importador como função pura.** Recebe as linhas da planilha e devolve `{ vendas válidas, para conferir, ignoradas }`. Assim ele é testável sem banco e sem tela.
- **Segredos só em variáveis de ambiente** (Vercel e `.env.local`), nunca no repositório.
- **Alternativa descartada, para o RFC:** um backend Express separado. Daria mais código para publicar e manter em um desafio de 2 horas, sem ganho para a Maria.
- **Versões:** as versões atuais do Next.js, do Prisma e do Supabase são conferidas na documentação ao criar o projeto, porque a configuração de conexão do Prisma mudou entre versões.

## 6. Referências de design

O visual segue uma regra: **se a Maria precisar de uma explicação, a tela está errada.**

**Inspirações visuais**

- **Mobills e Organizze:** apps brasileiros de finanças com cartões de resumo no topo e lista simples logo abaixo.
- **Template de dashboard do shadcn/ui:** referência de layout limpo, minimalista e responsivo.

**Estilo geral:** fundo claro, fonte sem serifa, cartões com bordas suaves e uma paleta neutra com um acento de cor (sugestão: verde-azulado). Cores com significado fixo: verde para recebido, laranja para "a receber".

**Princípios de usabilidade para a Maria**

- **Letra grande:** texto base de pelo menos 18 px, e botões com pelo menos 48 px de altura.
- **Um botão principal por tela:** "+ Nova venda" no painel e "Salvar venda" no formulário.
- **Perguntas em vez de campos:** "Como pagou?" com botões grandes, no lugar de listas escondidas.
- **Palavras do dia a dia:** "Apagar" e "Salvar", sem termos técnicos como "registro", "CRUD" ou "exportar CSV".
- **Erros que ensinam:** "Falta dizer quanto foi", no lugar de "campo obrigatório".
- **Sem medo de errar:** confirmação antes de apagar e botão "Desfazer" depois.
- **Ícone e texto juntos**, nunca só ícone.
- **Tela vazia que orienta:** sem vendas, aparece "Ainda não há vendas. Toque em + Nova venda".
- **Celular primeiro:** o layout funciona bem no celular e se expande no computador.
- **Contraste alto** (nível AA do WCAG) e foco visível para quem usa teclado.

## 7. Critérios de sucesso, fora de escopo e riscos

O projeto dá certo se uma pessoa sem familiaridade com tecnologia conseguir registrar, achar e corrigir vendas sozinha, e se a planilha antiga entrar no sistema sem perder nada.

**Como o produto responde ao que o desafio avalia**

| Critério do PDF | Peso | Como atendemos | Como mostramos |
| --- | --- | --- | --- |
| Clareza da ideia | 40% | O problema é descrito com as linhas reais da planilha (seção 1) e cada recurso responde a uma dor dela | PRD de uma página e uma frase de abertura: "a Maria registra uma venda em poucos toques" |
| O que foi entregue: ela usa sozinha? | 50% | Formulário guiado, botões grandes, busca única, "Desfazer" | Demonstração ao vivo de registrar, buscar e corrigir uma venda |
| O que foi entregue: trata o arquivo dela? | 50% | Importação que padroniza, pergunta nas dúvidas e guarda o original, mais o botão "Baixar planilha" | Importar as 72 linhas na demonstração e mostrar a lista "Para conferir" |
| Apresentação | 10% | Roteiro curto, com tempo marcado | Ensaio com cronômetro, até 15 minutos |

O desafio também pede para explicar **onde concordei ou discordei da IA**. Cada decisão em que a IA sugeriu algo diferente do que fizemos fica anotada durante o desenvolvimento.

**Metas de usabilidade (a validar com um teste)**

- Uma pessoa que nunca viu o sistema registra uma venda em menos de 30 segundos e sem ajuda.
- Essa mesma pessoa acha o código de rastreio de uma cliente usando só a busca.
- Ela marca uma venda fiada como paga sem errar o caminho.

**Fora de escopo**

- Controle de estoque e cadastro de produtos com preço fixo
- Vários usuários, perfis ou cadastro público
- Relatórios e gráficos avançados
- Integração com maquininha, Pix ou rastreio dos Correios
- Aplicativo nativo para celular
- Registro de venda por frase com IA (ideia para uma versão futura, só se sobrar tempo)

**Riscos**

| Risco | O que fazemos |
| --- | --- |
| Tempo curto (2 horas) | Fazer na ordem: login, registrar e listar, depois editar e apagar, importar e, por fim, exportar. Cada etapa já é uma entrega que funciona |
| Datas ambíguas na importação | Nunca adivinhar: marcar "Para conferir" e guardar o texto original |
| Prisma ignora o RLS do Supabase | Filtrar por dono em toda consulta e manter o RLS ligado como segunda barreira |
| A Maria esquecer a senha | Sessão longa e recuperação de senha por e-mail |
| Dados de venda expostos na demonstração | Sem cadastro público, login obrigatório e dados de exemplo na demonstração |

**Perguntas em aberto**

- As opções de entrega ficam em quatro (Levou na hora, Veio buscar, Correios, Motoboy)?
- Em `35+12 frete`, o frete entra no valor da venda ou fica só na observação?
