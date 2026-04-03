---
description: Guía de acceso y contexto técnico del servidor SARA (Satcom)
---

// turbo-all
# Contexto Técnico: Entornos Satcom (SARA y Producción)

Este documento define la separación de entornos para el RAG Multimodal de Satcom.

## 1. Entorno SARA (Desarrollo e Ingesta Pesada)
- **Host**: `129.146.162.57` (Ubuntu)
- **Función**: Procesamiento de archivos PDF, extracción de imágenes y ejecución de scripts Python.
- **n8n SARA**: Instancia local para pruebas de ingesta.

## 2. Entorno Producción (n8n Cloud/Final)
- **Función**: Punto de entrada final para despliegues validados.
- **n8n Producción**: Instancia principal de Satcom.

## Detalles de Conexión (SARA)
- **Usuario**: `ubuntu`
- **Llave SSH**: `ssh-key-2025-05-26.key` (Ubicada en `C:/Users/jesus/.gemini/antigravity/scratch/SARA/Keys/`)
- **Comando de Acceso**:
  ```bash
  ssh -i "C:/Users/jesus/.gemini/antigravity/scratch/SARA/Keys/ssh-key-2025-05-26.key" ubuntu@129.146.162.57
  ```

