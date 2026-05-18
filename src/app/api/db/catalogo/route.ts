import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db'; // Make sure this path is correct, or I should use standard Supabase initialization if needed

export async function GET(request: Request) {
  try {
    const { data, error } = await supabase
      .from('catalogo_eventos_manuales')
      .select('*')
      .order('evento', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { evento, programar_evento, afecta_uptime, severidad, activo } = body;

    const { data, error } = await supabase
      .from('catalogo_eventos_manuales')
      .insert([
        { evento, programar_evento, afecta_uptime, severidad, activo }
      ])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, evento, programar_evento, afecta_uptime, severidad, activo } = body;

    const { data, error } = await supabase
      .from('catalogo_eventos_manuales')
      .update({ evento, programar_evento, afecta_uptime, severidad, activo })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
