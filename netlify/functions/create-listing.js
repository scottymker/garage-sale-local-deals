// Creates a listing (free). Feature upgrade handled via Stripe webhook.
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

export default async (req) => {
  if(req.method !== 'POST') return new Response('Method not allowed', { status:405 });
  try{
    const body = await req.json();
    const id = crypto.randomUUID();

    const listing = {
      id,
      title: (body.title||'').slice(0,80),
      description: (body.description||'').slice(0,600),
      category: body.category || 'Garage Sale',
      date: body.date || null,
      timeStart: body.timeStart || '',
      timeEnd: body.timeEnd || '',
      address: body.address || '',
      contact: body.contact || '',
      photoUrl: body.photoUrl || '',
      lat: typeof body.lat === 'number' ? body.lat : null,
      lng: typeof body.lng === 'number' ? body.lng : null,
      featured: false,
      createdAt: Date.now()
    };

    const store = getStore({ name: 'listings' });
    await store.set(id, JSON.stringify(listing), { contentType:'application/json' });

    return new Response(JSON.stringify({ ok:true, id }), { headers:{'content-type':'application/json'}});
  }catch(e){
    return new Response(JSON.stringify({ error: e.message }), { status:500 });
  }
}
