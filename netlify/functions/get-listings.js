// Returns all active listings, newest first. Uses Netlify Blobs for storage.
import { getStore } from '@netlify/blobs';

export default async () => {
  try{
    const store = getStore({ name: 'listings' });
    const keys = await store.list();
    const items = [];
    for(const k of keys.blobs){
      const raw = await store.get(k.key, { type:'json' });
      if(!raw) continue;
      // filter out expired (7 days after date)
      const today = new Date(); today.setHours(0,0,0,0);
      const d = raw.date ? new Date(raw.date+'T00:00:00') : null;
      if(d){
        const expires = new Date(d); expires.setDate(expires.getDate()+7);
        if(expires < today) continue;
      }
      items.push(raw);
    }
    items.sort((a,b)=> (b.featured===true)-(a.featured===true) || (b.createdAt||0)-(a.createdAt||0));
    return new Response(JSON.stringify({ listings: items }), { headers:{'content-type':'application/json'}});
  }catch(e){
    return new Response(JSON.stringify({ error: e.message }), { status:500 });
  }
}
