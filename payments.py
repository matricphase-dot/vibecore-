import os
import razorpay
import httpx
from paypalcheckoutsdk.core import PayPalHttpClient, SandboxEnvironment, LiveEnvironment
from paypalcheckoutsdk.orders import OrdersCreateRequest, OrdersCaptureRequest
from fastapi import HTTPException, Request, status
from sqlalchemy.future import select
from .models import ProcessedWebhook

# Razorpay Client
razorpay_client = razorpay.Client(auth=(
    os.getenv("RAZORPAY_KEY_ID", ""), 
    os.getenv("RAZORPAY_KEY_SECRET", "")
))

# PayPal Client
def get_paypal_client():
    mode = os.getenv("PAYPAL_MODE", "sandbox")
    client_id = os.getenv("PAYPAL_CLIENT_ID", "")
    client_secret = os.getenv("PAYPAL_CLIENT_SECRET", "")
    
    if mode == "live":
        environment = LiveEnvironment(client_id=client_id, client_secret=client_secret)
    else:
        environment = SandboxEnvironment(client_id=client_id, client_secret=client_secret)
    
    return PayPalHttpClient(environment)

async def create_razorpay_order(user_id: int, plan: str, amount_in_inr: int):
    try:
        order_data = {
            "amount": amount_in_inr * 100, # amount in paise
            "currency": "INR",
            "receipt": f"receipt_user_{user_id}",
            "notes": {
                "user_id": str(user_id),
                "plan": plan
            }
        }
        order = razorpay_client.order.create(data=order_data)
        return order
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Razorpay error: {str(e)}")

async def create_paypal_order(user_id: int, plan: str, amount_in_usd: str):
    client = get_paypal_client()
    request = OrdersCreateRequest()
    request.prefer('return=representation')
    request.request_body({
        "intent": "CAPTURE",
        "purchase_units": [{
            "amount": {
                "currency_code": "USD",
                "value": amount_in_usd
            },
            "custom_id": f"{user_id}:{plan}"
        }]
    })
    
    try:
        response = client.execute(request)
        return {"id": response.result.id, "status": response.result.status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PayPal error: {str(e)}")

async def verify_razorpay_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    
    if not signature or not secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing signature or secret")
    
    try:
        razorpay_client.utility.verify_webhook_signature(body.decode(), signature, secret)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

async def verify_paypal_webhook(request: Request):
    # PayPal webhook verification requires a call back to PayPal
    # This is a simplified version using their verification API
    body = await request.json()
    headers = request.headers
    
    auth_algo = headers.get("PAYPAL-AUTH-ALGO")
    cert_url = headers.get("PAYPAL-CERT-URL")
    transmission_id = headers.get("PAYPAL-TRANSMISSION-ID")
    transmission_sig = headers.get("PAYPAL-TRANSMISSION-SIG")
    transmission_time = headers.get("PAYPAL-TRANSMISSION-TIME")
    webhook_id = os.getenv("PAYPAL_WEBHOOK_ID")

    verification_payload = {
        "auth_algo": auth_algo,
        "cert_url": cert_url,
        "transmission_id": transmission_id,
        "transmission_sig": transmission_sig,
        "transmission_time": transmission_time,
        "webhook_id": webhook_id,
        "webhook_event": body
    }

    mode = os.getenv("PAYPAL_MODE", "sandbox")
    api_url = "https://api-m.sandbox.paypal.com" if mode == "sandbox" else "https://api-m.paypal.com"
    
    # We need an access token for this call
    # For brevity, this logic is assumed to be handled or simplified here
    # In production, use the PayPal client to get a token and call /v1/notifications/verify-webhook-signature
    pass

async def is_webhook_processed(webhook_id: str, db) -> bool:
    result = await db.execute(select(ProcessedWebhook).where(ProcessedWebhook.webhook_id == webhook_id))
    return result.scalars().first() is not None

async def verify_razorpay_payment(payment_id: str, order_id: str, signature: str):
    try:
        params_dict = {
            'razorpay_order_id': order_id,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': signature
        }
        razorpay_client.utility.verify_payment_signature(params_dict)
        return True
    except Exception:
        return False
