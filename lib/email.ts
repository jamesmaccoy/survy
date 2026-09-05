import { getProperty, getUserProfile, updateBooking } from "./firebase";

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export async function sendBookingConfirmationEmail(booking: {
  id: string;
  propertyId: string;
  packageId: string | null;
  customerName: string;
  customerEmail: string;
  fromDate: string;
  toDate: string;
  total: number;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Resend] RESEND_API_KEY is not defined in environment.");
    return false;
  }

  if (!booking || !booking.customerEmail) {
    console.warn("[Resend] Cannot send booking confirmation email: missing booking or customerEmail.", booking);
    return false;
  }

  try {
    const property = await getProperty(booking.propertyId);
    const hostId = property?.hostId || "mock_admin_example_com";
    const hostProfile = await getUserProfile(hostId);
    
    let hostEmail = "";
    
    const HOST_MAP: Record<string, string> = {
      "I8cgAm2UQddZM7cAfT74cmsxunj1": "surfyogacommunity@icloud.com",
      "cE63u7tstuREl9Kjy9YPhTnEI513": "thankyou.digital@gmail.com",
      "mock_thankyou_digital_gmail_com": "thankyou.digital@gmail.com",
      "mock_jmaclachlan_gmail_com": "jmaclachlan@gmail.com",
      "mock_admin_example_com": "jamesmac@gmail.com"
    };

    if (HOST_MAP[hostId]) {
      hostEmail = HOST_MAP[hostId];
    } else if (hostId.startsWith("mock_")) {
      const clean = hostId.substring(5);
      if (clean.endsWith("_gmail_com")) {
        hostEmail = `${clean.substring(0, clean.length - 10).replace(/_/g, ".")}@gmail.com`;
      } else if (clean.endsWith("_co_za")) {
        hostEmail = `${clean.substring(0, clean.length - 6).replace(/_/g, ".")}@co.za`;
      } else {
        hostEmail = `${clean.replace(/_/g, ".")}@gmail.com`;
      }
    } else {
      if (hostProfile?.email) {
        hostEmail = hostProfile.email;
      } else {
        try {
          const { getAuth } = require("firebase-admin/auth");
          const auth = getAuth();
          const userRecord = await auth.getUser(hostId);
          if (userRecord && userRecord.email) {
            hostEmail = userRecord.email;
          }
        } catch (err) {
          console.warn("[Resend] Auth lookup fallback failed for hostId:", hostId, err);
        }
      }
    }

    if (!hostEmail) {
      hostEmail = "jamesmac@gmail.com";
    }

    const customerEmail = booking.customerEmail;

    let start = new Date(booking.fromDate);
    let end = new Date(booking.toDate);
    const isHourly = property?.bookingType === "hourly";

    // Helper to construct a Date at a specific hour/minute in SAST (UTC+2) timezone
    const setTimeInSast = (date: Date, hours: number, minutes: number): Date => {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      const hh = String(hours).padStart(2, "0");
      const mm = String(minutes).padStart(2, "0");
      const isoStr = `${year}-${month}-${day}T${hh}:${mm}:00+02:00`;
      return new Date(isoStr);
    };

    if (!isHourly) {
      start = setTimeInSast(start, 14, 0); // Check-in at 14:00 SAST
      end = setTimeInSast(end, 10, 0); // Check-out at 10:00 SAST
    }

    const formatSastDateTime = (date: Date): string => {
      return date.toLocaleString("en-ZA", {
        timeZone: "Africa/Johannesburg",
        dateStyle: "medium",
        timeStyle: "short"
      });
    };

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Simpleplek//Stay Booking//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:booking-${booking.id}@simpleplek.co.za`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:Stay Booking - ${property?.title || "Simpleplek Stay"}`,
      `DESCRIPTION:Booking Reference: ${booking.id}\\nCustomer Name: ${booking.customerName}\\nPackage: ${booking.packageId || "Standard Stay"}\\nProperty: ${property?.title || "Stay"}\\nTotal Paid: R ${booking.total}`,
      `LOCATION:${property?.location || property?.title || "Llandudno"}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const base64Ics = Buffer.from(icsContent).toString("base64");

    const hostSubdomain = hostProfile?.subdomain;
    const bookingUrl = hostSubdomain
      ? `https://${hostSubdomain}.simpleplek.co.za/bookings/${booking.id}`
      : `https://simpleplek.co.za/bookings/${booking.id}`;

    const subject = isHourly
      ? `Booking Paid & Confirmed - ${property?.title || "Slot"}`
      : `Booking Paid & Confirmed - ${property?.title || "Stay"}`;
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0d9488; margin-top: 0;">${isHourly ? "Slot Booking Confirmed!" : "Stay Booking Confirmed!"}</h2>
        <p>Hi <strong>${booking.customerName}</strong>,</p>
        <p>Your payment has been successfully processed, and your ${isHourly ? "slot" : "stay"} is confirmed.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Booking Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Property:</td>
              <td style="padding: 6px 0; font-weight: bold; text-align: right;">${property?.title || "Stay"}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Booking ID:</td>
              <td style="padding: 6px 0; font-weight: bold; text-align: right; font-family: monospace;">${booking.id}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">${isHourly ? "Date & Time:" : "From:"}</td>
              <td style="padding: 6px 0; font-weight: bold; text-align: right;">${formatSastDateTime(start)}</td>
            </tr>
            ${!isHourly ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b;">To:</td>
              <td style="padding: 6px 0; font-weight: bold; text-align: right;">${formatSastDateTime(end)}</td>
            </tr>
            ` : ""}
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Package:</td>
              <td style="padding: 6px 0; font-weight: bold; text-align: right;">${booking.packageId || (isHourly ? "Standard Slot" : "Standard Stay")}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 10px 0 0 0; font-weight: bold;">Amount Paid:</td>
              <td style="padding: 10px 0 0 0; font-weight: bold; text-align: right; color: #0d9488; font-size: 16px;">R ${Number(booking.total || 0).toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 25px 0; text-align: center;">
          <a href="${bookingUrl}" style="background-color: #0d9488; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">View Booking Overview</a>
        </div>
        
        <p>A calendar event file (.ics) has been attached to this email. You can open it to add this reservation to your calendar.</p>
        <p>Regards,<br/><strong>Simpleplek Team</strong></p>
      </div>
    `;

    // Send to BOTH host (pro) and customer (guest)
    const recipients = Array.from(new Set([customerEmail, hostEmail])).filter(Boolean) as string[];

    console.log(`[Resend] Sending confirmation email to ${recipients.join(", ")}...`);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM_ADDRESS || "Simpleplek <noreply@simpleplek.co.za>",
        to: recipients,
        subject: subject,
        html: emailHtml,
        attachments: [
          {
            filename: "invite.ics",
            content: base64Ics
          }
        ]
      })
    });

    const responseData = await res.json();
    if (res.ok) {
      console.log(`[Resend] Confirmation email sent successfully. ID: ${responseData.id}`);
      if (booking.id) {
        await updateBooking(booking.id, {
          confirmationEmailSent: true,
          confirmationEmailSentAt: new Date().toISOString(),
          confirmationEmailId: responseData.id
        }).catch((err) => console.warn("[Resend] Could not update booking email flag:", err));
      }
      return true;
    } else {
      console.error("[Resend] Failed to send email via API:", responseData);
      if (booking.id) {
        await updateBooking(booking.id, {
          confirmationEmailSent: false,
          confirmationEmailError: JSON.stringify(responseData)
        }).catch((err) => console.warn("[Resend] Could not update booking email flag:", err));
      }
      return false;
    }
  } catch (error: any) {
    console.error("[Resend] Error in sendBookingConfirmationEmail:", error);
    if (booking?.id) {
      await updateBooking(booking.id, {
        confirmationEmailSent: false,
        confirmationEmailError: error?.message || "Unknown error"
      }).catch((err) => console.warn("[Resend] Could not update booking email flag:", err));
    }
    return false;
  }
}

export async function sendMagicLinkEmail(email: string, magicLink: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Resend] RESEND_API_KEY is not defined. Printing magic link to console:");
    console.log(`🔑 Magic Link for ${email}: ${magicLink}`);
    return true;
  }

  const subject = "Sign in to Simpleplek";
  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #0d9488; margin-top: 0;">Sign in to Simpleplek</h2>
      <p>Click the button below to sign in to your account. This link will expire in 1 hour.</p>
      
      <div style="margin: 30px 0; text-align: center;">
        <a href="${magicLink}" style="background-color: #0d9488; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Sign In Now</a>
      </div>
      
      <p style="color: #64748b; font-size: 12px;">If you didn't request this link, you can safely ignore this email.</p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM_ADDRESS || "Simpleplek <noreply@simpleplek.co.za>",
        to: [email],
        subject: subject,
        html: emailHtml
      })
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`[Resend] Magic link email sent successfully to ${email}. ID: ${data.id}`);
      return true;
    } else {
      console.error("[Resend] Failed to send magic link:", data);
      return false;
    }
  } catch (error) {
    console.error("[Resend] Error in sendMagicLinkEmail:", error);
    return false;
  }
}
