// Test script to verify the filtering logic
const workflows = [
    {
        id: "filtered_sara",
        name: "Test workflow - Pruebas",
        source: "SARA",
        tags: [{ name: "Pruebas" }]
    },
    {
        id: "filtered_primary",
        name: "Test workflow - Pruebas Primary",
        source: "Satcom (Primary)",
        tags: [{ name: "Pruebas " }] // with space
    },
    {
        id: "keep_sara",
        name: "Real workflow",
        source: "SARA",
        tags: [{ name: "Production" }]
    },
    {
        id: "keep_no_tags",
        name: "No tags workflow",
        source: "SARA",
        tags: []
    }
];

const filterPruebas = (w) => !w.tags?.some((tag) => tag.name.trim() === 'Pruebas');

const filtered = workflows.filter(filterPruebas);

console.log("Original count:", workflows.length);
console.log("Filtered count:", filtered.length);
console.log("Remaining IDs:", filtered.map(w => w.id).join(", "));

if (filtered.length === 2 && filtered.every(w => w.id.startsWith("keep"))) {
    console.log("SUCCESS: Filter logic works as expected.");
} else {
    console.log("FAILURE: Filter logic did not produce expected results.");
    process.exit(1);
}
