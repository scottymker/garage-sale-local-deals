// One-time payment to feature a listing.
import Stripe from 'stripe';
import { getStore } from '@netlify/blobs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async (req) => {
  if(req.method !== 'POST') return new Response('Method not allowed', { status:405 });
  try{
    const { listingId, amountCents = 700 } = await req.json();
    if(!listingId) throw new Error('Missing listingId');

    // Confirm listing exists
    const store = getStore({ name: 'listings' });
    const listing = await store.get(listingId, { type:'json' });
    if(!listing) throw new Error('Listing not found');

    const origin = req.headers.get('origin') || process.env.SITE_URL || 'http://localhost:8888';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: `Feature: ${listing.title.slice(0,50)}`,
            description: `Featured pin for ${listing.date || 'your listing'}`
          }
        },
        quantity: 1
      }],
      success_url: `${origin}/?featured=success`,
      cancel_url: `${origin}/?featured=cancel`,
      metadata: { listingId }
    });

    return new Response(JSON.stringify({ url: session.url }), { headers:{'content-type':'application/json'}});
  }catch(e){
    return new Response(JSON.stringify({ error: e.message }), { status:500 });
  }
}
