import requests
import json
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv('.env.local')

N8N_SARA_HOST = os.environ.get('N8N_SARA_HOST', 'https://sara.mysatcomla.com/')
N8N_SARA_JWT = os.environ.get('N8N_SARA_JWT')
WORKFLOW_ID = '9SUpGm5FL4xSDkNN'

if not N8N_SARA_JWT:
    print("❌ Error: No se encontró N8N_SARA_JWT en .env.local")
    exit(1)

# URLs
get_url = f"{N8N_SARA_HOST.rstrip('/')}/api/v1/workflows/{WORKFLOW_ID}"
put_url = get_url

headers = {
    'X-N8N-API-KEY': N8N_SARA_JWT,
    'Content-Type': 'application/json'
}

def fix_workflow():
    # 1. Obtener el flujo actual
    print("🔄 Obteniendo workflow desde n8n...")
    response = requests.get(get_url, headers=headers)
    if response.status_code != 200:
        print(f"❌ Error al obtener el flujo: {response.status_code} - {response.text}")
        return
    
    workflow_data = response.json()
    
    # 2. Modificar el messageData del nodo Redis
    modified = False
    
    # Buscamos en los nodos principales
    for node in workflow_data.get('nodes', []):
        if node.get('type') == 'n8n-nodes-base.redis':
            params = node.get('parameters', {})
            msg_data = params.get('messageData', '')
            # Si contiene el texto incorrecto, lo cambiamos
            if '"timestamp": new Date().toISOString()' in msg_data:
                print("💡 Nodo Redis encontrado con timestamp sin evaluar en 'nodes'. Corrigiendo...")
                new_msg_data = msg_data.replace(
                    '"timestamp": new Date().toISOString()',
                    '"timestamp": "{{ new Date().toISOString() }}"'
                )
                params['messageData'] = new_msg_data
                modified = True
                
    # Buscamos también en activeVersion (si existe)
    active_version = workflow_data.get('activeVersion', {})
    if active_version:
        for node in active_version.get('nodes', []):
            if node.get('type') == 'n8n-nodes-base.redis':
                params = node.get('parameters', {})
                msg_data = params.get('messageData', '')
                if '"timestamp": new Date().toISOString()' in msg_data:
                    print("💡 Nodo Redis encontrado con timestamp sin evaluar en 'activeVersion'. Corrigiendo...")
                    new_msg_data = msg_data.replace(
                        '"timestamp": new Date().toISOString()',
                        '"timestamp": "{{ new Date().toISOString() }}"'
                    )
                    params['messageData'] = new_msg_data
                    modified = True

    if not modified:
        print("ℹ️ No se detectó el timestamp incorrecto o ya está corregido.")
        return

    # 3. Guardar cambios en el servidor
    # La API de n8n requiere que enviemos name, nodes, connections, settings, staticData, meta
    payload = {
        "name": workflow_data.get("name"),
        "nodes": workflow_data.get("nodes"),
        "connections": workflow_data.get("connections"),
        "settings": workflow_data.get("settings"),
        "staticData": workflow_data.get("staticData"),
        "meta": workflow_data.get("meta")
    }

    print("📤 Enviando actualización a n8n...")
    put_response = requests.put(put_url, headers=headers, json=payload)
    if put_response.status_code == 200:
        print("✅ Workflow actualizado con éxito. El timestamp ahora se generará dinámicamente en n8n.")
    else:
        print(f"❌ Error al actualizar el flujo: {put_response.status_code} - {put_response.text}")

if __name__ == '__main__':
    fix_workflow()
