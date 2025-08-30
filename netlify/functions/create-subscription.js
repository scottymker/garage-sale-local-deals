// Subscription checkout for business sponsors (monthly).
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Change amount as needed
const SPONSOR_PRICE_CENTS = 2900;

export default async (req) => {
  if(req.method !== 'POST') return new Response('Method not allowed', { status:405 });
  try{
    const origin = req.headers.get('origin') || process.env.SITE_URL || 'http://localhost:8888';

    // Create on-the-fly price to avoid dashboard work (ok for MVP)
    const price = await stripe.prices.create({
      unit_amount: SPONSOR_PRICE_CENTS,
      currency: 'usd',
      recurring: { interval: 'month' },
      product_data: { name: 'Local Deals Sponsor' }
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${origin}/?sponsor=success`,
      cancel_url: `${origin}/?sponsor=cancel`
    });

    return new Response(JSON.stringify({ url: session.url }), { headers:{'content-type':'application/json'}});
  }catch(e){
    return new Response(JSON.stringify({ error: e.message }), { status:500 });
  }
}
