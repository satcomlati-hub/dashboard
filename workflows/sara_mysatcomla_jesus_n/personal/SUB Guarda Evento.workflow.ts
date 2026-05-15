import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SUB Guarda Evento
// Nodes   : 5  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WhenExecutedByAnotherWorkflow      executeWorkflowTrigger
// ExecuteASqlQuery                   postgres                   [creds]
// IfNuevoEvento                      if
// CrearCasoDesk                      httpRequest                [creds]
// NoOperationDoNothing               noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenExecutedByAnotherWorkflow
//    → ExecuteASqlQuery
//      → IfNuevoEvento
//        → CrearCasoDesk
//       .out(1) → NoOperationDoNothing
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'EslvlrtfJOP0OawH',
    name: 'SUB Guarda Evento',
    active: true,
    tags: ['Monitoreo MySatcom'],
    settings: { executionOrder: 'v1', binaryMode: 'separate' },
})
export class SubGuardaEventoWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '9f984ed5-a058-449c-b186-578a33d7d71a',
        name: 'When Executed by Another Workflow',
        type: 'n8n-nodes-base.executeWorkflowTrigger',
        version: 1.1,
        position: [-448, -208],
    })
    WhenExecutedByAnotherWorkflow = {
        workflowInputs: {
            values: [
                {
                    name: 'p_ambiente',
                },
                {
                    name: 'p_version',
                },
                {
                    name: 'p_pais',
                },
                {
                    name: 'p_evento',
                },
                {
                    name: 'p_detalle_evento',
                },
                {
                    name: 'p_reporta',
                },
                {
                    name: 'p_fecha_evento',
                },
                {
                    name: 'p_key',
                },
                {
                    name: 'p_num_eventos',
                    type: 'number',
                },
                {
                    name: 'p_mensaje',
                },
                {
                    name: 'estado',
                },
                {
                    name: 'ticket_payload',
                },
            ],
        },
    };

    @node({
        id: 'd7cb16d0-61f9-45f6-9ae5-fb094647e4dc',
        name: 'Execute a SQL query',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-144, -208],
        credentials: { postgres: { id: 'e9lRiPBv5aq4p35i', name: 'Postgres SATCOMTI' } },
    })
    ExecuteASqlQuery = {
        operation: 'executeQuery',
        query: `SELECT mysatcom.upsert_bitacora_evento(
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
) as status;`,
        options: {
            queryReplacement: `={{ [   
$('When Executed by Another Workflow').item.json.p_ambiente,
$('When Executed by Another Workflow').item.json.p_version || '-',
$('When Executed by Another Workflow').item.json.p_pais,
$('When Executed by Another Workflow').item.json.p_evento,
$('When Executed by Another Workflow').item.json.p_detalle_evento,
$('When Executed by Another Workflow').item.json.p_reporta,
$('When Executed by Another Workflow').item.json.p_fecha_evento,
$('When Executed by Another Workflow').item.json.p_key,
$('When Executed by Another Workflow').item.json.p_num_eventos,
$('When Executed by Another Workflow').item.json.p_mensaje,
$('When Executed by Another Workflow').item.json.estado || 'activo'
] }}`,
        },
    };

    @node({
        id: 'if-nuevo-evento-id',
        name: 'If Nuevo Evento',
        type: 'n8n-nodes-base.if',
        version: 2.3,
        position: [96, -208],
    })
    IfNuevoEvento = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 3,
            },
            conditions: [
                {
                    id: 'cond-status-check',
                    leftValue: "={{ $('Execute a SQL query').item.json.status }}",
                    rightValue: 'CREATED',
                    operator: {
                        type: 'string',
                        operation: 'equals',
                    },
                },
                {
                    id: 'acccf367-804e-47e3-a4d0-cde2a8f56172',
                    leftValue: "={{ $('When Executed by Another Workflow').item.json.p_key }}",
                    rightValue: 'REGLA-TICKET',
                    operator: {
                        type: 'string',
                        operation: 'contains',
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'http-request-casos-desk-id',
        name: 'Crear Caso Desk',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [352, -368],
        credentials: { httpBasicAuth: { id: 'hZhDNPRBS15OUz0S', name: 'CrearCasosSatcom.APP' } },
    })
    CrearCasoDesk = {
        method: 'POST',
        url: 'https://satcomla.app.n8n.cloud/webhook/CasosDesk',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpBasicAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ typeof $('When Executed by Another Workflow').item.json.ticket_payload === 'string' ? $('When Executed by Another Workflow').item.json.ticket_payload : JSON.stringify($('When Executed by Another Workflow').item.json.ticket_payload) }}",
        options: {},
    };

    @node({
        id: 'bd6c7f4f-f47d-4f34-98b6-87dbd6ab366a',
        name: 'No Operation, do nothing',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [320, -64],
    })
    NoOperationDoNothing = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenExecutedByAnotherWorkflow.out(0).to(this.ExecuteASqlQuery.in(0));
        this.ExecuteASqlQuery.out(0).to(this.IfNuevoEvento.in(0));
        this.IfNuevoEvento.out(0).to(this.CrearCasoDesk.in(0));
        this.IfNuevoEvento.out(1).to(this.NoOperationDoNothing.in(0));
    }
}
