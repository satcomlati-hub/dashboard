import { NextResponse } from 'next/server';

const SUPABASE_URL = 'https://wpzfbpvtxrfyejoqjecu.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const BUCKET = 'chat-uploads';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file || !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Image file required' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Max 10MB' }, { status: 400 });
    }

    // Generar nombre único: timestamp + random
    const ext = file.name?.split('.').pop() || 'png';
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `uploads/${filename}`;

    // Subir a Supabase Storage
    const buffer = await file.arrayBuffer();
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': file.type,
          'x-upsert': 'true',
        },
        body: buffer,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error('Storage upload error:', err);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    // URL pública
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

    return NextResponse.json({ url: publicUrl, path, expiresIn: '24h' });
  } catch (error) {
    console.error('Upload API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
