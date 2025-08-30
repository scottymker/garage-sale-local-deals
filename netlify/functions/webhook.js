// Stripe webhook: mark listing as featured after successful payment.
import Stripe from 'stripe';
import { getStore } from '@netlify/blobs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const config = { path: "/.netlify/functions/webhook" };

export default async (req) => {
  const sig = req.headers.get('stripe-signature');
  let event;
  const body = await req.arrayBuffer();

  try{
    event = stripe.webhooks.constructEvent(Buffer.from(body), sig, endpointSecret);
  }catch(err){
    return new Response(`Webhook signature verification failed. ${err.message}`, { status:400 });
  }

  // When payment is successful for feature purchase
  if(event.type === 'checkout.session.completed'){
    const session = event.data.object;
    if(session.mode === 'payment' && session.metadata?.listingId){
      const listingId = session.metadata.listingId;
      const store = getStore({ name: 'listings' });
      const listing = await store.get(listingId, { type:'json' });
      if(listing){
        listing.featured = true;
        await store.set(listingId, JSON.stringify(listing), { contentType:'application/json' });
      }
    }
  }

  return new Response('ok', { status:200 });
}
