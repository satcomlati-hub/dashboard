import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Ruta absoluta a la carpeta de producción
const PRODUCCION_PATH = 'C:\\Users\\jesus\\.gemini\\antigravity\\Interfaz\\Produccion_Satcom';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get('file');

  try {
    if (fileName) {
      // Validar que el archivo sea JSON y esté dentro de la carpeta permitida
      if (!fileName.endsWith('.json')) {
        return NextResponse.json({ error: 'Solo se permiten archivos JSON' }, { status: 400 });
      }

      const filePath = path.join(PRODUCCION_PATH, fileName);
      
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      return NextResponse.json(JSON.parse(content));
    }

    // Si no hay nombre de archivo, listar archivos JSON
    if (!fs.existsSync(PRODUCCION_PATH)) {
      return NextResponse.json({ error: 'Carpeta de producción no encontrada' }, { status: 404 });
    }

    const files = fs.readdirSync(PRODUCCION_PATH)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        name: f.replace('.json', ''),
        fileName: f
      }));

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error in local workflows API:', error);
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
  }
}
