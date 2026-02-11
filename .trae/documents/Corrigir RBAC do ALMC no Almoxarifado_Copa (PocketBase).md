## Diagnóstico
- Confirmar que o erro é RBAC de PocketBase: logar como ALMC, ir em `/almoxarifado` e tentar criar/editar/excluir um item; checar no Network que `POST/PATCH/DELETE` em `agenda_cap53_itens_servico` retorna 403.
- Conferir o schema real da coleção `agenda_cap53_itens_servico` no PocketBase (campos `name`, `category`, `unit`, `stock`) para garantir compatibilidade com o payload da UI em [AlmacManagement.tsx](file:///c:/Users/Usu%C3%A1rio/Desktop/PROJETOS%20-%20DEV/agenda-cap5.3-A/pages/AlmacManagement.tsx).

## Correção (Reprodutível no repo)
- Ajustar [setup_agenda_cap53.js](file:///c:/Users/Usu%C3%A1rio/Desktop/PROJETOS%20-%20DEV/agenda-cap5.3-A/scripts/setup_agenda_cap53.js) para que a coleção `agenda_cap53_itens_servico` tenha:
  - `createRule: @request.auth.role = "ADMIN" || @request.auth.role = "ALMC"`
  - `updateRule: @request.auth.role = "ADMIN" || @request.auth.role = "ALMC"`
  - `deleteRule: @request.auth.role = "ADMIN" || @request.auth.role = "ALMC"`
  - Manter `listRule`/`viewRule` exigindo usuário autenticado.
- Remover credenciais hardcoded desse script e ler de variáveis de ambiente (ex.: `PB_URL`, `PB_ADMIN_EMAIL`, `PB_ADMIN_PASS`) para cumprir o requisito “sem expor secrets em commits/logs”.

## Aplicar no PocketBase (Ambiente atual)
- Executar o script de setup atualizado (com variáveis de ambiente) para atualizar rules da coleção no servidor.
- Se o schema do servidor estiver divergente (ex.: campo `type` ao invés de `category`), ajustar o schema via o mesmo mecanismo de `syncCollection` no script, priorizando a correção de rules.

## Validação (Critérios de aceite)
- ALMC: criar item (aparece na listagem), editar item (nome/categoria/unidade), excluir item.
- ADMIN: tudo continua funcionando.
- USER/TRA/CE: manter sem permissão de create/update/delete nessa coleção (403 na API).
- Verificar regressão: CreateEvent continua listando itens via `agenda_cap53_itens_servico` e não quebra.

## Observação de consistência
- Há dois setups diferentes no repo (`agenda_itens_servico` vs `agenda_cap53_itens_servico`) com schemas/rules distintos; vou manter o foco no `agenda_cap53_*` porque é o que a UI usa, evitando alterar o restante sem necessidade.