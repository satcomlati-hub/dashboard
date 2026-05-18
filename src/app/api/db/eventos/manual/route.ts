import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

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

    const { data, error } = await supabase
      .from('bitacora_eventos')
      .insert([
        { 
          key,
          evento,
          ambiente: ambiente || 'N/A',
          version: version || 'N/A',
          pais: 'GLOBAL', // Default
          detalle_evento: detalleEvento,
          reporta: 'Usuario Manual',
          fecha_evento: fechaEvento.toISOString(),
          num_eventos: duracionHoras ? parseInt(duracionHoras) : 1, // Duración en horas
          estado,
          mensaje: programado ? 'Evento Programado' : 'Registro Manual'
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
