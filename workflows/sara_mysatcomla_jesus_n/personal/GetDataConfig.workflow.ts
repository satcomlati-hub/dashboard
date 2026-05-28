import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : GetDataConfig
// Nodes   : 5  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// Webhook                            webhook
// GetRowS                            dataTable
// Getdata                            code
// RespondToWebhook                   respondToWebhook
// AggregateResults                   code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Webhook
//    → Getdata
//      → GetRowS
//        → AggregateResults
//          → RespondToWebhook
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '5i49gwRHIvDfs3HE',
    name: 'GetDataConfig',
    active: true,
    settings: { executionOrder: 'v1', binaryMode: 'separate' },
})
export class GetdataconfigWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'de1c39e2-4120-47e1-8b3e-be2a257e0ab3',
        webhookId: 'bc6de3b9-a4b5-4f77-ad20-b77a5182f22f',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [-272, -256],
    })
    Webhook = {
        path: 'GetConfigList',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: '91ba9572-2a15-4d55-8bce-770630e7f827',
        name: 'Get row(s)',
        type: 'n8n-nodes-base.dataTable',
        version: 1.1,
        position: [176, -256],
    })
    GetRowS = {
        operation: 'get',
        dataTableId: {
            __rl: true,
            value: "={{ $('getData').item.json.Table }}",
            mode: 'name',
        },
    };

    @node({
        id: 'a4b15a5d-c2cb-4e6a-a645-3a3773743798',
        name: 'getData',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-48, -256],
    })
    Getdata = {
        jsCode: 'return [$input.first().json.query];',
    };

    @node({
        id: '9e310d16-df70-4f1f-9b80-7554ef3f4212',
        name: 'Respond to Webhook',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.5,
        position: [624, -256],
    })
    RespondToWebhook = {
        options: {},
    };

    @node({
        id: 'cfe5ab45-4f90-45f3-857e-d37338d800a7',
        name: 'Aggregate Results',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [400, -256],
    })
    AggregateResults = {
        jsCode: `return {
  items: $input.all().map(i => {
    if (i.json.result) return i.json.result;
    return i.json;
  })
};`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Webhook.out(0).to(this.Getdata.in(0));
        this.Getdata.out(0).to(this.GetRowS.in(0));
        this.GetRowS.out(0).to(this.AggregateResults.in(0));
        this.AggregateResults.out(0).to(this.RespondToWebhook.in(0));
    }
}
