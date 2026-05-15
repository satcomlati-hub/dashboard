import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : API DetallesEventos
// Nodes   : 7  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ExecuteASqlQuery                   postgres                   [onError→regular] [creds] [alwaysOutput]
// RespondToWebhook                   respondToWebhook
// EditFields                         set
// Input                              webhook
// If_                                if
// ExecuteASqlQuery1                  postgres                   [onError→regular] [creds] [alwaysOutput]
// RespondToWebhook1                  respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Input
//    → EditFields
//      → If_
//        → ExecuteASqlQuery
//          → RespondToWebhook
//       .out(1) → ExecuteASqlQuery1
//          → RespondToWebhook1
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
        id: '51ed860f-eb50-4c8d-b1ee-384487f004b4',
        name: 'Execute a SQL query',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-560, 16],
        credentials: { postgres: { id: 'e9lRiPBv5aq4p35i', name: 'Postgres SATCOMTI' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
    })
    ExecuteASqlQuery = {
        operation: 'executeQuery',
        query: "select * from mysatcom.get_bitacora_eventos(null, '{{ $json.Range }}')",
        schema: {
            mode: 'list',
            value: 'mysatcom',
        },
        table: {
            mode: 'list',
            value: 'bitacora_eventos',
        },
        options: {
            queryReplacement: '=',
            replaceEmptyStrings: true,
        },
    };

    @node({
        id: 'b4e15671-b43b-483b-9e44-63e7884f5654',
        name: 'Respond to Webhook',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.5,
        position: [-336, 16],
    })
    RespondToWebhook = {
        respondWith: 'allIncomingItems',
        options: {},
    };

    @node({
        id: '68287c04-7ac2-489a-ac79-0ff518066a84',
        name: 'Edit Fields',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [-1008, 112],
    })
    EditFields = {
        assignments: {
            assignments: [
                {
                    id: '43da9a7f-3d06-42ef-89dd-87f12fcb6154',
                    name: 'Evento',
                    value: "={{ $('Input').item?.json?.query?.Evento ||'' }}",
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
        id: '55db8fea-92e9-4dd1-9172-52e29753d346',
        webhookId: 'c51a1ec0-4cb9-4850-aad4-8dc812d06845',
        name: 'Input',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [-1232, 112],
    })
    Input = {
        path: 'DetalleEventosRabbit',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: '7471d5ee-d58f-4358-bc2f-2df78c958bf3',
        name: 'If',
        type: 'n8n-nodes-base.if',
        version: 2.3,
        position: [-784, 112],
    })
    If_ = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 3,
            },
            conditions: [
                {
                    id: 'dc257e44-ae75-45c9-8e46-4938795371e0',
                    leftValue: '={{ $json.Evento }}',
                    rightValue: '',
                    operator: {
                        type: 'string',
                        operation: 'empty',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'f88a9646-a6c1-4f81-a227-74224fffdc3b',
        name: 'Execute a SQL query1',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-560, 208],
        credentials: { postgres: { id: 'e9lRiPBv5aq4p35i', name: 'Postgres SATCOMTI' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
    })
    ExecuteASqlQuery1 = {
        operation: 'executeQuery',
        query: "select * from mySatcom.get_bitacora_eventos('{{ $json.Evento }}', '{{ $json.Range }}')",
        schema: {
            mode: 'list',
            value: 'mysatcom',
        },
        table: {
            mode: 'list',
            value: 'bitacora_eventos',
        },
        options: {
            queryReplacement: '=',
            replaceEmptyStrings: true,
        },
    };

    @node({
        id: 'bf2ce917-20d4-4895-aede-3646a8d4b397',
        name: 'Respond to Webhook1',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.5,
        position: [-336, 208],
    })
    RespondToWebhook1 = {
        respondWith: 'allIncomingItems',
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ExecuteASqlQuery.out(0).to(this.RespondToWebhook.in(0));
        this.EditFields.out(0).to(this.If_.in(0));
        this.Input.out(0).to(this.EditFields.in(0));
        this.If_.out(0).to(this.ExecuteASqlQuery.in(0));
        this.If_.out(1).to(this.ExecuteASqlQuery1.in(0));
        this.ExecuteASqlQuery1.out(0).to(this.RespondToWebhook1.in(0));
    }
}
