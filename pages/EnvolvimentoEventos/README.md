# Meu Espaço

Esta página permite que os usuários acompanhem e gerenciem seu envolvimento em eventos, incluindo eventos organizados, convites recebidos, solicitações pendentes, histórico completo e estatísticas de engajamento.

## Requisitos Técnicos

- **Integração com PocketBase**: Consome as coleções `agenda_cap53_eventos`, `agenda_cap53_notifications` e `agenda_cap53_solicitacoes_evento`.
- **Visualização de Dados**: Utiliza a biblioteca `recharts` para exibir gráficos de pizza, linha, barras e radar.
- **Cache**: Implementação de cache de 5 minutos no frontend para reduzir requisições redundantes.
- **Acessibilidade**: Seguindo padrões WCAG 2.1 AA com skeletons de carregamento e estados vazios.
- **Responsividade**: Layout adaptável para dispositivos móveis e desktop.

## Estrutura de Pastas

```text
pages/
└── EnvolvimentoEventos/
    ├── README.md             # Esta documentação
    └── MyInvolvement.tsx     # Implementação principal (movida para pages/ no momento)
```

## Exemplos de Payload (PocketBase)

### Evento (agenda_cap53_eventos)
```json
{
  "title": "Workshop React 19",
  "description": "Explorando as novidades do React 19",
  "date_start": "2026-03-15 09:00:00.000Z",
  "status": "published",
  "user": "RECORD_ID_DO_ORGANIZADOR",
  "participants": ["USER_ID_1", "USER_ID_2"],
  "location": "LOCATION_RECORD_ID"
}
```

### Notificação de Convite (agenda_cap53_notifications)
```json
{
  "user": "USER_ID_DO_CONVIDADO",
  "title": "Convite para Evento",
  "message": "Você foi convidado para o evento Workshop React 19",
  "type": "event_invite",
  "invite_status": "pending",
  "event": "EVENT_RECORD_ID",
  "read": false
}
```

## Instruções de Deploy

1. Certifique-se de que o PocketBase está configurado com as coleções mencionadas acima.
2. Verifique se as permissões (API Rules) do PocketBase permitem a leitura e escrita pelo usuário autenticado.
3. O build é realizado através do comando `npm run build` ou `vite build`.
4. Os arquivos estáticos gerados na pasta `dist` podem ser servidos por qualquer servidor web (Nginx, Apache, Vercel, Netlify).

## Próximos Passos

- Implementar testes de cobertura total (E2E).
- Adicionar suporte a exportação de relatórios em PDF/CSV.
- Melhorar a granularidade das estatísticas.
