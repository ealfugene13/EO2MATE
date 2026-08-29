import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const META_GRAPH_VERSION = "v23.0";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
/* =========================================================
   LOGGING
   ========================================================= */ function log(message, data) {
  if (data !== undefined) {
    console.log(message, data);
  } else {
    console.log(message);
  }
}
function errorLog(message, data) {
  if (data !== undefined) {
    console.error(message, data);
  } else {
    console.error(message);
  }
}
/* =========================================================
   FIND WINNER
   ========================================================= */ async function findWinner(bidWinnerId) {
  const { data, error } = await supabase.from("auction_winners").select("*").eq("bid_winner_id", bidWinnerId).maybeSingle();
  if (error) {
    throw new Error(`auction_winners lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Winner ${bidWinnerId} was not found.`);
  }
  return data;
}
/* =========================================================
   FIND WINNING BID
   ========================================================= */ async function findWinningBid(bidId) {
  const { data, error } = await supabase.from("auction_bids").select("*").eq("bid_id", bidId).maybeSingle();
  if (error) {
    throw new Error(`auction_bids lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Winning bid ${bidId} was not found.`);
  }
  return data;
}
/* =========================================================
   FIND AUCTION ITEM
   ========================================================= */ async function findAuctionItem(auctionItemId) {
  const { data, error } = await supabase.from("auction_items").select("*").eq("auction_item_id", auctionItemId).maybeSingle();
  if (error) {
    throw new Error(`auction_items lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Auction item ${auctionItemId} was not found.`);
  }
  return data;
}
/* =========================================================
   FIND PAYMENT
   ========================================================= */ async function findPayment(bidWinnerId) {
  /*
   * We only want the payment that was created
   * by create-payment.
   *
   * Valid states for sending the checkout link:
   *
   * pending
   * unpaid
   *
   * If already paid, we do not send a payment link.
   */ const { data, error } = await supabase.from("payments").select("*").eq("bid_winner_id", bidWinnerId).order("created_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`payments lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`No payment record found for winner ${bidWinnerId}.`);
  }
  return data;
}
/* =========================================================
   FIND FACEBOOK PAGE
   ========================================================= */ async function findFacebookPage(fbPageId) {
  const { data, error } = await supabase.from("fb_pages").select("*").eq("fb_page_id", fbPageId).maybeSingle();
  if (error) {
    throw new Error(`fb_pages lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Facebook Page ${fbPageId} is not registered.`);
  }
  if (!data.access_token) {
    throw new Error(`Facebook Page ${fbPageId} has no access token.`);
  }
  return data;
}
/* =========================================================
   FIND PAGE FROM AUCTION ITEM
   ========================================================= */ async function findPageForAuctionItem(auctionItemId) {
  /*
   * auction_items
   *      ↓
   * auction_posts
   *      ↓
   * fb_page_id
   */ const { data: auctionItem, error: itemError } = await supabase.from("auction_items").select("auction_post_id").eq("auction_item_id", auctionItemId).maybeSingle();
  if (itemError) {
    throw new Error(`auction_items page lookup failed: ${itemError.message}`);
  }
  if (!auctionItem) {
    throw new Error(`Auction item ${auctionItemId} was not found.`);
  }
  const { data: auctionPost, error: postError } = await supabase.from("auction_posts").select("fb_page_id, fb_post_id").eq("post_id", auctionItem.auction_post_id).maybeSingle();
  if (postError) {
    throw new Error(`auction_posts lookup failed: ${postError.message}`);
  }
  if (!auctionPost) {
    throw new Error(`Auction post for item ${auctionItemId} was not found.`);
  }
  if (!auctionPost.fb_page_id) {
    throw new Error(`Auction post has no Facebook Page ID.`);
  }
  return auctionPost;
}
/* =========================================================
   META GRAPH REQUEST
   ========================================================= */ async function metaRequest(endpoint, accessToken, method = "GET", body) {
  const url = `https://graph.facebook.com/` + `${META_GRAPH_VERSION}/${endpoint}`;
  const params = new URLSearchParams();
  params.set("access_token", accessToken);
  if (body) {
    for (const [key, value] of Object.entries(body)){
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }
  }
  const response = await fetch(method === "GET" ? `${url}?${params.toString()}` : url, {
    method,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: method === "GET" ? undefined : params
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch  {
    json = {
      raw: text
    };
  }
  if (!response.ok || json?.error) {
    throw new Error(`Meta API error ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}
/* =========================================================
   SEND MESSENGER MESSAGE
   ========================================================= */ async function sendMessengerMessage(pageAccessToken, recipientId, message) {
  /*
   * Messenger Send API
   *
   * POST /PAGE_ID/messages
   */ const result = await metaRequest("me/messages", pageAccessToken, "POST", {
    recipient: JSON.stringify({
      id: recipientId
    }),
    message: JSON.stringify({
      text: message
    })
  });
  log("Messenger message sent", {
    recipientId,
    result
  });
  return result;
}
/* =========================================================
   FORMAT PAYMENT MESSAGE
   ========================================================= */ function formatPaymentMessage(itemLabel, amount, checkoutUrl) {
  return `Congratulations! You won the auction for "${itemLabel}".\n\n` + `Winning amount: PHP ${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}\n\n` + `Please complete your payment using the link below:\n\n` + `${checkoutUrl}\n\n` + `Thank you!`;
}
/* =========================================================
   HTTP HANDLER
   ========================================================= */ Deno.serve(async (req)=>{
  try {
    /* -----------------------------------------------------
         METHOD
         ----------------------------------------------------- */ if (req.method !== "POST") {
      return Response.json({
        success: false,
        error: "Method Not Allowed"
      }, {
        status: 405
      });
    }
    /* -----------------------------------------------------
         REQUEST BODY
         ----------------------------------------------------- */ let body;
    try {
      body = await req.json();
    } catch  {
      return Response.json({
        success: false,
        error: "Invalid JSON request body."
      }, {
        status: 400
      });
    }
    const bidWinnerId = body?.bid_winner_id;
    if (!bidWinnerId) {
      return Response.json({
        success: false,
        error: "bid_winner_id is required."
      }, {
        status: 400
      });
    }
    log("Send payment Messenger request", {
      bidWinnerId
    });
    /* -----------------------------------------------------
         FIND WINNER
         ----------------------------------------------------- */ const winner = await findWinner(bidWinnerId);
    log("Winner found", {
      bidWinnerId,
      winnerStatus: winner.status,
      auctionItemId: winner.auction_item_id,
      bidId: winner.bid_id,
      winningAmount: winner.winning_amt
    });
    /* -----------------------------------------------------
         WINNER STATUS
         ----------------------------------------------------- */ if (winner.status === "CANCELLED") {
      return Response.json({
        success: false,
        error: "This winner has been cancelled."
      }, {
        status: 400
      });
    }
    /*
       * Payment can be sent for PENDING
       * or CONFIRMED winners.
       */ if (winner.status !== "PENDING" && winner.status !== "CONFIRMED") {
      return Response.json({
        success: false,
        error: `Winner cannot receive payment request because its status is ${winner.status}.`
      }, {
        status: 400
      });
    }
    /* -----------------------------------------------------
         FIND WINNING BID
         ----------------------------------------------------- */ if (!winner.bid_id) {
      throw new Error("Winner has no winning bid ID.");
    }
    const winningBid = await findWinningBid(winner.bid_id);
    /* -----------------------------------------------------
         FACEBOOK USER ID
         ----------------------------------------------------- */ const fbUserId = winningBid.fb_user_id;
    if (!fbUserId) {
      throw new Error("Winning bid has no Facebook user ID.");
    }
    log("Messenger recipient identified", {
      fbUserId,
      fbUserName: winningBid.fb_user_name
    });
    /* -----------------------------------------------------
         FIND AUCTION ITEM
         ----------------------------------------------------- */ const auctionItem = await findAuctionItem(winner.auction_item_id);
    /* -----------------------------------------------------
         FIND PAYMENT
         ----------------------------------------------------- */ const payment = await findPayment(bidWinnerId);
    log("Payment found", {
      paymentId: payment.payment_id,
      status: payment.status,
      amount: payment.amount,
      checkoutUrl: payment.checkout_url
    });
    /* -----------------------------------------------------
         PAYMENT STATUS
         ----------------------------------------------------- */ if (payment.status === "paid") {
      return Response.json({
        success: false,
        already_paid: true,
        error: "This auction payment has already been paid.",
        payment_id: payment.payment_id
      }, {
        status: 400
      });
    }
    if (payment.status === "failed" || payment.status === "cancelled" || payment.status === "expired") {
      return Response.json({
        success: false,
        error: `Payment cannot be sent because payment status is ${payment.status}.`,
        payment_id: payment.payment_id
      }, {
        status: 400
      });
    }
    /* -----------------------------------------------------
         CHECKOUT URL
         ----------------------------------------------------- */ if (!payment.checkout_url) {
      throw new Error("Payment has no checkout URL.");
    }
    /* -----------------------------------------------------
         FIND FACEBOOK PAGE
         ----------------------------------------------------- */ const auctionPost = await findPageForAuctionItem(winner.auction_item_id);
    const fbPageId = String(auctionPost.fb_page_id);
    const fbPage = await findFacebookPage(fbPageId);
    /* -----------------------------------------------------
         PAYMENT AMOUNT
         ----------------------------------------------------- */ const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payment has an invalid amount.");
    }
    /* -----------------------------------------------------
         MESSAGE
         ----------------------------------------------------- */ const message = formatPaymentMessage(auctionItem.item_label || "Auction Item", amount, payment.checkout_url);
    log("Sending payment link through Messenger", {
      fbPageId,
      fbUserId,
      itemLabel: auctionItem.item_label,
      amount,
      checkoutUrl: payment.checkout_url
    });
    /* -----------------------------------------------------
         SEND MESSAGE
         ----------------------------------------------------- */ const messengerResult = await sendMessengerMessage(fbPage.access_token, fbUserId, message);
    /* -----------------------------------------------------
         SUCCESS
         ----------------------------------------------------- */ return Response.json({
      success: true,
      message_sent: true,
      recipient: {
        fb_user_id: fbUserId,
        fb_user_name: winningBid.fb_user_name
      },
      payment: {
        payment_id: payment.payment_id,
        bid_winner_id: payment.bid_winner_id,
        auction_item_id: payment.auction_item_id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        checkout_url: payment.checkout_url
      },
      messenger: {
        recipient_id: fbUserId,
        result: messengerResult
      }
    }, {
      status: 200
    });
  } catch (error) {
    errorLog("SEND PAYMENT MESSENGER ERROR", {
      error: String(error)
    });
    return Response.json({
      success: false,
      error: String(error)
    }, {
      status: 500
    });
  }
});
