/**
* This file was @generated using pocketbase-typegen
*/

export enum Collections {
	AgendaCap53AlmacRequests = "agenda_cap53_almac_requests",
	AgendaCap53Eventos = "agenda_cap53_eventos",
	AgendaCap53Notifications = "agenda_cap53_notifications",
	AgendaCap53Participantes = "agenda_cap53_participantes",
	AgendaCap53Usuarios = "agenda_cap53_usuarios",
	AgendaCap53Locais = "agenda_cap53_locais",
	AgendaCap53TiposEvento = "agenda_cap53_tipos_evento",
	AgendaCap53ItensServico = "agenda_cap53_itens_servico",
	AgendaCap53SolicitacoesEvento = "agenda_cap53_solicitacoes_evento",
	AgendaCap53SalasBatepapo = "agenda_cap53_salas_batepapo",
	AgendaCap53MensagensSalas = "agenda_cap53_mensagens_salas",
  AgendaAuditLogs = "agenda_audit_logs",
}

// System fields
export type BaseSystemFields<T = never> = {
	id: string
	created: string
	updated: string
	collectionId: string
	collectionName: Collections
	expand?: T
}

export type AuthSystemFields<T = never> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// User
export interface UsersRecord {
	name?: string
	avatar?: string
	role?: string
	sector?: string
	bio?: string
    observations?: string
	whatsapp?: string
	birthDate?: string
	admissionDate?: string
	active?: boolean
	lastActive?: string
	status?: string
    context_status?: string
    online?: boolean
    favorites?: string[]
}

// Event
export interface EventsRecord {
	title: string
	type?: string
	description?: string
	user: string // User ID
	location?: string
	custom_location?: string
	date_start?: string
	date_end?: string
	participants?: string[] // User IDs
	participants_roles?: Record<string, string> // JSON
	participants_status?: Record<string, string> // JSON
	unidades?: string[] // JSON/Select
	categorias_profissionais?: string[] // JSON/Select
	transporte_suporte?: boolean
	transporte_origem?: string
	transporte_destino?: string
	transporte_horario_levar?: string
	transporte_horario_buscar?: string
	transporte_passageiro?: string | number
	transporte_obs?: string
	transporte_status?: string
	is_restricted?: boolean
	creator_role?: string
	observacoes?: string
	estimated_participants?: number
	event_responsibility?: string
}

// Participant
export interface ParticipantesRecord {
	event: string
	user: string
	status?: 'pending' | 'accepted' | 'declined'
}

// Almac Request
export interface AlmacRequestsRecord {
	event: string
	item: string
	status?: string
	created_by: string
	quantity?: number
	item_snapshot_available?: boolean
	history?: any[] // JSON
    justification?: string
}

// Notification
export interface NotificationsRecord {
	user: string
	title: string
	message: string
	type?: string
	read?: boolean
	event?: string
	related_request?: string
	invite_status?: string
	data?: any // JSON
}

// Locais
export interface LocaisRecord {
    name: string
    conflict_control?: boolean
}

// Tipos Evento
export interface TiposEventoRecord {
    name: string
    active?: boolean
}

// Itens Servico
export interface ItensServicoRecord {
    name: string
    category?: string
    is_available?: boolean
    description?: string
    image?: string
}

// Solicitacoes Evento
export interface SolicitacoesEventoRecord {
    event: string
    user: string
    status?: 'pending' | 'approved' | 'rejected'
    message?: string
}

// Salas Batepapo
export interface SalasBatepapoRecord {
    event: string
    created_by: string
    status?: 'active' | 'archived'
}

// Mensagens Salas
export interface MensagensSalasRecord {
    room: string
    sender: string
    content: string
}

// Response Types
export type UsersResponse<Texpand = unknown> = UsersRecord & AuthSystemFields<Texpand>
export type EventsResponse<Texpand = unknown> = EventsRecord & BaseSystemFields<Texpand>
export type ParticipantesResponse<Texpand = unknown> = ParticipantesRecord & BaseSystemFields<Texpand>
export type AlmacRequestsResponse<Texpand = unknown> = AlmacRequestsRecord & BaseSystemFields<Texpand>
export type NotificationsResponse<Texpand = unknown> = NotificationsRecord & BaseSystemFields<Texpand>
export type LocaisResponse<Texpand = unknown> = LocaisRecord & BaseSystemFields<Texpand>
export type TiposEventoResponse<Texpand = unknown> = TiposEventoRecord & BaseSystemFields<Texpand>
export type ItensServicoResponse<Texpand = unknown> = ItensServicoRecord & BaseSystemFields<Texpand>
export type SolicitacoesEventoResponse<Texpand = unknown> = SolicitacoesEventoRecord & BaseSystemFields<Texpand>
export type SalasBatepapoResponse<Texpand = unknown> = SalasBatepapoRecord & BaseSystemFields<Texpand>
export type MensagensSalasResponse<Texpand = unknown> = MensagensSalasRecord & BaseSystemFields<Texpand>

// Schema Map
export type CollectionRecords = {
	[Collections.AgendaCap53AlmacRequests]: AlmacRequestsRecord
	[Collections.AgendaCap53Eventos]: EventsRecord
	[Collections.AgendaCap53Notifications]: NotificationsRecord
	[Collections.AgendaCap53Participantes]: ParticipantesRecord
	[Collections.AgendaCap53Usuarios]: UsersRecord
    [Collections.AgendaCap53Locais]: LocaisRecord
    [Collections.AgendaCap53TiposEvento]: TiposEventoRecord
    [Collections.AgendaCap53ItensServico]: ItensServicoRecord
    [Collections.AgendaCap53SolicitacoesEvento]: SolicitacoesEventoRecord
    [Collections.AgendaCap53SalasBatepapo]: SalasBatepapoRecord
    [Collections.AgendaCap53MensagensSalas]: MensagensSalasRecord
}

export type CollectionResponses = {
	[Collections.AgendaCap53AlmacRequests]: AlmacRequestsResponse
	[Collections.AgendaCap53Eventos]: EventsResponse
	[Collections.AgendaCap53Notifications]: NotificationsResponse
	[Collections.AgendaCap53Participantes]: ParticipantesResponse
	[Collections.AgendaCap53Usuarios]: UsersResponse
    [Collections.AgendaCap53Locais]: LocaisResponse
    [Collections.AgendaCap53TiposEvento]: TiposEventoResponse
    [Collections.AgendaCap53ItensServico]: ItensServicoResponse
    [Collections.AgendaCap53SolicitacoesEvento]: SolicitacoesEventoResponse
    [Collections.AgendaCap53SalasBatepapo]: SalasBatepapoResponse
    [Collections.AgendaCap53MensagensSalas]: MensagensSalasResponse
}
