// src/lib/email.server.ts

// ─── Shared helper ───────────────────────────────────────────────────────────

function getMailjetCredentials() {
  const apiKey = process.env.MAILJET_API_KEY?.trim();
  const apiSecret = process.env.MAILJET_SECRET_KEY?.trim();
  const senderEmail = process.env.MAILJET_SENDER_EMAIL?.trim();
  return { apiKey, apiSecret, senderEmail };
}

function buildAuthHeader(apiKey: string, apiSecret: string) {
  return `Basic ${btoa(`${apiKey}:${apiSecret}`)}`;
}

async function sendEmail(authHeader: string, payload: object) {
  try {
    const res = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.json();
      console.error("Mailjet Error:", errBody);
    } else {
      console.log("Email sent successfully.");
    }
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}

// ─── Booking Confirmation ─────────────────────────────────────────────────────

export async function sendBookingConfirmationEmail(params: {
  email: string;
  name: string;
  hotelName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  invoiceNumber: string;
  totalAmount: number;
}) {
  const { apiKey, apiSecret, senderEmail } = getMailjetCredentials();
  if (!apiKey || !apiSecret || !senderEmail) {
    console.error("Mailjet credentials missing. Skipping email.");
    return;
  }

  const authHeader = buildAuthHeader(apiKey, apiSecret);

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <div style="text-align: center; border-bottom: 1px solid #eaeaea; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #d4af37; margin: 0; font-size: 24px;">HimalStay</h2>
      </div>

      <h1 style="font-size: 20px;">Booking Confirmed!</h1>
      <p>Hi ${params.name},</p>
      <p>Thank you for choosing HimalStay. Your payment was successful and your reservation is confirmed.</p>

      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
        <h3 style="margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Reservation Details</h3>
        <p><strong>Invoice #:</strong> ${params.invoiceNumber}</p>
        <p><strong>Hotel:</strong> ${params.hotelName}</p>
        <p><strong>Room:</strong> ${params.roomName}</p>
        <p><strong>Check-in:</strong> ${params.checkIn}</p>
        <p><strong>Check-out:</strong> ${params.checkOut}</p>
        <p><strong>Total Paid:</strong> $${params.totalAmount.toFixed(2)} USD</p>
      </div>

      <p>You can view or download your full invoice anytime by logging into your account.</p>
      <p>Safe travels,<br>The HimalStay Team</p>
    </div>
  `;

  await sendEmail(authHeader, {
    Messages: [
      {
        From: { Email: senderEmail, Name: "HimalStay Reservations" },
        To: [{ Email: params.email, Name: params.name }],
        Subject: `Booking Confirmed: ${params.hotelName} (${params.checkIn})`,
        HTMLPart: htmlContent,
      },
    ],
  });

  console.log(`Confirmation email sent to ${params.email}`);
}

// ─── Booking Cancellation ─────────────────────────────────────────────────────

export async function sendBookingCancellationEmail(params: {
  email: string;
  name: string;
  hotelName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  bookingId: string;
}) {
  const { apiKey, apiSecret, senderEmail } = getMailjetCredentials();
  if (!apiKey || !apiSecret || !senderEmail) {
    console.error("Mailjet credentials missing. Skipping email.");
    return;
  }

  const authHeader = buildAuthHeader(apiKey, apiSecret);

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <div style="text-align: center; border-bottom: 1px solid #eaeaea; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #d4af37; margin: 0; font-size: 24px;">HimalStay</h2>
      </div>

      <h1 style="font-size: 20px; color: #dc2626;">Reservation Cancelled</h1>
      <p>Hi ${params.name},</p>
      <p>This email confirms that your reservation at <strong>${params.hotelName}</strong> has been successfully cancelled.</p>

      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0; border-left: 4px solid #dc2626;">
        <h3 style="margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Cancelled Trip Details</h3>
        <p><strong>Booking Ref:</strong> ${params.bookingId.slice(0, 8).toUpperCase()}</p>
        <p><strong>Hotel:</strong> ${params.hotelName}</p>
        <p><strong>Room:</strong> ${params.roomName}</p>
        <p><strong>Check-in:</strong> ${params.checkIn}</p>
        <p><strong>Check-out:</strong> ${params.checkOut}</p>
      </div>

      <p><em>Note: If you pre-paid for this reservation via Khalti, our team will review the cancellation and process any eligible refunds according to our standard policy.</em></p>

      <p>We hope to welcome you another time.<br><br>Safe travels,<br>The HimalStay Team</p>
    </div>
  `;

  await sendEmail(authHeader, {
    Messages: [
      {
        From: { Email: senderEmail, Name: "HimalStay Support" },
        To: [{ Email: params.email, Name: params.name }],
        Subject: `Reservation Cancelled: ${params.hotelName}`,
        HTMLPart: htmlContent,
      },
    ],
  });

  console.log(`Cancellation email sent to ${params.email}`);
}

// ─── Check-In ─────────────────────────────────────────────────────────────────

export async function sendCheckInEmail(params: {
  email: string;
  name: string;
  hotelName: string;
  roomName: string;
  wifiPassword?: string;
}) {
  const { apiKey, apiSecret, senderEmail } = getMailjetCredentials();
  if (!apiKey || !apiSecret || !senderEmail) {
    console.error("Mailjet credentials missing. Skipping email.");
    return;
  }

  const authHeader = buildAuthHeader(apiKey, apiSecret);

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <div style="text-align: center; border-bottom: 1px solid #eaeaea; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #d4af37; margin: 0; font-size: 24px;">HimalStay</h2>
      </div>

      <h1 style="font-size: 20px;">Welcome to ${params.hotelName}!</h1>
      <p>Hi ${params.name},</p>
      <p>You are officially checked into the <strong>${params.roomName}</strong>. We are thrilled to have you with us.</p>
      <p>If you need anything during your stay — extra towels, room service, or local recommendations — please reach out to the front desk.</p>
      ${params.wifiPassword ? `<p><strong>WiFi Password:</strong> ${params.wifiPassword}</p>` : ""}
      <p>Enjoy your stay,<br>The Team at ${params.hotelName}</p>
    </div>
  `;

  await sendEmail(authHeader, {
    Messages: [
      {
        From: { Email: senderEmail, Name: params.hotelName },
        To: [{ Email: params.email, Name: params.name }],
        Subject: `Welcome to ${params.hotelName} – You're Checked In`,
        HTMLPart: htmlContent,
      },
    ],
  });

  console.log(`Check-in email sent to ${params.email}`);
}

// ─── Check-Out ────────────────────────────────────────────────────────────────

export async function sendCheckOutEmail(params: {
  email: string;
  name: string;
  hotelName: string;
  invoiceNumber: string;
}) {
  const { apiKey, apiSecret, senderEmail } = getMailjetCredentials();
  if (!apiKey || !apiSecret || !senderEmail) {
    console.error("Mailjet credentials missing. Skipping email.");
    return;
  }

  const authHeader = buildAuthHeader(apiKey, apiSecret);

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <div style="text-align: center; border-bottom: 1px solid #eaeaea; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #d4af37; margin: 0; font-size: 24px;">HimalStay</h2>
      </div>

      <h1 style="font-size: 20px;">Thank You for Staying!</h1>
      <p>Hi ${params.name},</p>
      <p>You have successfully checked out of <strong>${params.hotelName}</strong>.</p>
      <p>We hope you had a wonderful time. Your final folio (Invoice #${params.invoiceNumber}) has been settled and is available to download from your account dashboard.</p>
      <p>Safe travels home, and we hope to see you again soon.</p>
      <p>Warm regards,<br>The Team at ${params.hotelName}</p>
    </div>
  `;

  await sendEmail(authHeader, {
    Messages: [
      {
        From: { Email: senderEmail, Name: params.hotelName },
        To: [{ Email: params.email, Name: params.name }],
        Subject: `Thank You for Staying at ${params.hotelName}`,
        HTMLPart: htmlContent,
      },
    ],
  });

  console.log(`Check-out email sent to ${params.email}`);
}

// Add to the bottom of src/lib/email.server.ts

export async function sendFolioEmail(params: { 
  email: string; 
  name: string; 
  hotelName: string; 
  invoiceNumber: string;
  balanceDue: number;
}) {
  const authHeader = `Basic ${btoa(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_SECRET_KEY}`)}`;
  
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #d4af37;">Your Folio Update - ${params.hotelName}</h2>
      <p>Hi ${params.name},</p>
      <p>Per your request, we have attached a copy of your current room folio (Ref: #${params.invoiceNumber}).</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #d4af37; margin: 20px 0;">
        <p style="margin: 0; font-size: 18px;"><strong>Current Balance Due:</strong> $${params.balanceDue.toFixed(2)} USD</p>
      </div>

      <p>You can view the fully itemized receipt at any time by logging into your HimalStay account.</p>
      <p>If you have any questions about these charges, please speak with the front desk.</p>
      <p>Warm regards,<br>The Team at ${params.hotelName}</p>
    </div>
  `;

  await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      Messages: [{
        From: { Email: process.env.MAILJET_SENDER_EMAIL, Name: params.hotelName },
        To: [{ Email: params.email, Name: params.name }],
        Subject: `Your Room Folio - ${params.hotelName}`,
        HTMLPart: htmlContent,
      }],
    }),
  }).catch(console.error);
}