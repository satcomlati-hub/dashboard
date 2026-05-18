import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : API DetallesEventos
// Nodes   : 6  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// Input                              webhook
// ExecuteASqlQuery                   postgres                   [creds]
// EditFields                         set
// If_                                if
// ExecuteASqlQuery1                  postgres                   [creds]
// Response                           respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Input
//    → EditFields
//      → If_
//        → ExecuteASqlQuery1
//          → Response
//       .out(1) → ExecuteASqlQuery
//          → Response (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'GjKc3IP6gwn1U0kq',
    name: 'API DetallesEventos',
    active: true,
    settings: {
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        binaryMode: 'separate',
        availableInMCP: false,
    },
})
export class ApiDetalleseventosWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'ac105fa6-851d-4940-b350-987676dabf61',
        webhookId: 'fe9844bc-d633-4d06-8bfa-815540a4362e',
        name: 'Input',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 0],
    })
    Input = {
        path: 'DetalleEventosRabbit',
        options: {},
    };

    @node({
        id: '50f11be7-44bb-4de5-8a9f-b2878dae5ef6',
        name: 'Execute a SQL query',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [600, 100],
        credentials: { postgres: { id: 'Zq7qQZ6fO98yT6Xv', name: 'Supabase Satcom' } },
    })
    ExecuteASqlQuery = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'mysatcom',
        },
        table: {
            mode: 'list',
            value: 'bitacora_eventos',
        },
        query: "select * from mysatcom.get_bitacora_eventos(null, '{{ $json.Range }}')",
    };

    @node({
        id: '0287cc6f-2b5a-49b6-9f30-cd3d87e9a4af',
        name: 'Edit Fields',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [200, 0],
    })
    EditFields = {
        assignments: {
            assignments: [
                {
                    id: 'evento-param-id',
                    name: 'Evento',
                    value: "={{ $('Input').item?.json?.query?.evento }}",
                    type: 'string',
                },
                {
                    id: 'range-param-id',
                    name: 'Range',
                    value: "={{ $('Input').item?.json?.query?.range || 'hoy' }}",
                    type: 'string',
                },
            ],
        },
        options: {},
    };

    @node({
        id: '7d0a4369-7ec2-4429-acfb-d571debb430f',
        name: 'If',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [400, 0],
    })
    If_ = {
        conditions: {
            string: [
                {
                    value1: '={{ $json.Evento }}',
                    value2: '',
                    operation: 'notEqual',
                },
            ],
        },
    };

    @node({
        id: '1041c205-7081-46ae-9122-58ab890e1cb2',
        name: 'Execute a SQL query 1',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [600, -100],
        credentials: { postgres: { id: 'Zq7qQZ6fO98yT6Xv', name: 'Supabase Satcom' } },
    })
    ExecuteASqlQuery1 = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'mysatcom',
        },
        table: {
            mode: 'list',
            value: 'bitacora_eventos',
        },
        query: "select * from mysatcom.get_bitacora_eventos('{{ $json.Evento }}', '{{ $json.Range }}')",
    };

    @node({
        id: '6f03c6f6-3ae7-418a-8fbb-cfbd3ff4d00b',
        name: 'Response',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [900, 0],
    })
    Response = {
        options: {
            responseCode: 200,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Input.out(0).to(this.EditFields.in(0));
        this.EditFields.out(0).to(this.If_.in(0));
        this.If_.out(0).to(this.ExecuteASqlQuery1.in(0));
        this.If_.out(1).to(this.ExecuteASqlQuery.in(0));
        this.ExecuteASqlQuery1.out(0).to(this.Response.in(0));
        this.ExecuteASqlQuery.out(0).to(this.Response.in(0));
    }
}
