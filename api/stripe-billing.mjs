import Stripe from "stripe";

const secretKey=process.env.STRIPE_SECRET_KEY||"";
const webhookSecret=process.env.STRIPE_WEBHOOK_SECRET||"";
const stripe=secretKey?new Stripe(secretKey):null;

export function stripeState(){
  return {configured:!!stripe,webhook_configured:!!webhookSecret,livemode:secretKey.startsWith("sk_live_")};
}

function required(){
  if(!stripe)throw Object.assign(new Error("Stripe billing is not configured"),{status:503,code:"billing_not_configured"});
  return stripe;
}

export async function stripeAccount(){return required().accounts.retrieve();}
export async function listStripePrices(){
  const client=required(),prices=await client.prices.list({active:true,type:"recurring",limit:100,expand:["data.product"]});
  return prices.data.map(price=>({price_id:price.id,product_id:typeof price.product==="string"?price.product:price.product.id,product_name:typeof price.product==="string"?price.product:price.product.name,active:price.active,currency:price.currency,unit_amount:price.unit_amount,interval:price.recurring?.interval,interval_count:price.recurring?.interval_count||1}));
}

export async function retrieveOrCreateCustomer({user,customerId,onCreated}){
  const client=required();
  if(customerId){try{return await client.customers.retrieve(customerId)}catch(error){if(error?.statusCode!==404)throw error}}
  const customer=await client.customers.create({email:user.email||undefined,name:user.user_metadata?.display_name||undefined,metadata:{feathermap_user_id:user.id}});
  await onCreated(customer.id);
  return customer;
}

export async function createCheckout({customerId,userId,priceId,tier,successUrl,cancelUrl,automaticTax,promotionCodes,trialDays}){
  const subscriptionData={metadata:{feathermap_user_id:userId,feathermap_tier:tier}};
  if(trialDays>0)subscriptionData.trial_period_days=trialDays;
  return required().checkout.sessions.create({mode:"subscription",customer:customerId,client_reference_id:userId,line_items:[{price:priceId,quantity:1}],success_url:successUrl,cancel_url:cancelUrl,automatic_tax:{enabled:automaticTax},customer_update:{address:"auto",name:"auto"},allow_promotion_codes:promotionCodes,subscription_data:subscriptionData,metadata:{feathermap_user_id:userId,feathermap_tier:tier}});
}

export async function createPortal({customerId,returnUrl}){return required().billingPortal.sessions.create({customer:customerId,return_url:returnUrl});}
export function constructStripeEvent(rawBody,signature){
  if(!webhookSecret)throw Object.assign(new Error("Stripe webhook verification is not configured"),{status:503,code:"billing_not_configured"});
  try{return required().webhooks.constructEvent(rawBody,signature,webhookSecret)}catch{throw Object.assign(new Error("Invalid Stripe webhook signature"),{status:400,code:"invalid_webhook_signature"})}
}
export async function retrieveSubscription(id){return required().subscriptions.retrieve(id);}

export async function listBillingTransactions({customerId,limit=25}={}){
  const invoices=await required().invoices.list({...(customerId?{customer:customerId}:{}),limit:Math.max(1,Math.min(100,Number(limit)||25))});
  return invoices.data.map(invoice=>{const parentSubscription=invoice.parent?.subscription_details?.subscription,subscription=invoice.subscription||parentSubscription;return{id:invoice.id,number:invoice.number||null,customer_id:typeof invoice.customer==="string"?invoice.customer:invoice.customer?.id||null,customer_email:invoice.customer_email||null,customer_name:invoice.customer_name||null,subscription_id:typeof subscription==="string"?subscription:subscription?.id||null,status:invoice.status,currency:invoice.currency,amount_due:invoice.amount_due||0,amount_paid:invoice.amount_paid||0,amount_remaining:invoice.amount_remaining||0,billing_reason:invoice.billing_reason||null,created_at:new Date(invoice.created*1000).toISOString(),period_start:invoice.period_start?new Date(invoice.period_start*1000).toISOString():null,period_end:invoice.period_end?new Date(invoice.period_end*1000).toISOString():null,hosted_invoice_url:invoice.hosted_invoice_url||null,invoice_pdf:invoice.invoice_pdf||null}});
}

export function normalizedSubscription(subscription,levelKey){
  const itemPeriodEnds=(subscription.items?.data||[]).map(item=>Number(item.current_period_end)||0),periodEnd=Number(subscription.current_period_end)||Math.max(0,...itemPeriodEnds),status=subscription.status==="incomplete_expired"?"expired":subscription.status;
  return {level_key:levelKey,status,billing_provider:"stripe",external_customer_id:typeof subscription.customer==="string"?subscription.customer:subscription.customer.id,external_subscription_id:subscription.id,current_period_end:periodEnd?new Date(periodEnd*1000).toISOString():null,expires_at:periodEnd?new Date(periodEnd*1000).toISOString():null,cancel_at_period_end:!!subscription.cancel_at_period_end,updated_at:new Date().toISOString()};
}
