import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      evento, 
      ambiente, 
      detalle, 
      version, 
      fecha, 
      hora, 
      duracionHoras, 
      severidad,
      programado
    } = body;

    // Combine date and time if it's scheduled, otherwise use current time
    let fechaEvento = new Date();
    if (programado && fecha && hora) {
      fechaEvento = new Date(`${fecha}T${hora}:00`);
    }

    // Format the detail to include severity
    const detalleEvento = `[${severidad}] ${detalle || 'Sin detalles'}`;
    const estado = programado ? 'PROGRAMADO' : 'REGISTRADO';
    const key = `MANUAL-${evento.replace(/\s+/g, '-')}-${Date.now()}`;
    const numEventos = duracionHoras ? parseInt(duracionHoras) : 1;

    const { rows } = await query(
      `INSERT INTO mysatcom.bitacora_eventos 
       (key, evento, ambiente, version, pais, detalle_evento, reporta, fecha_evento, num_eventos, estado, mensaje) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        key, 
        evento, 
        ambiente || 'N/A', 
        version || 'N/A', 
        'GLOBAL', 
        detalleEvento, 
        'Usuario Manual', 
        fechaEvento.toISOString(), 
        numEventos, 
        estado, 
        programado ? 'Evento Programado' : 'Registro Manual'
      ]
    );

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
