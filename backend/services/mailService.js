const env = require('../config/env');

const ensureBrevoConfigured = () => {
  if (!env.brevoApiKey || !env.brevoSenderEmail) {
    const error = new Error('Brevo email delivery is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL to enable password reset emails.');
    error.statusCode = 503;
    throw error;
  }
};

const sendPasswordResetEmail = async ({ toEmail, toName, resetUrl }) => {
  ensureBrevoConfigured();

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.brevoApiKey
    },
    body: JSON.stringify({
      sender: {
        email: env.brevoSenderEmail,
        name: env.brevoSenderName
      },
      to: [
        {
          email: toEmail,
          name: toName || toEmail
        }
      ],
      subject: 'Reset your KEREA HRMS password',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
          <h2 style="margin-bottom: 12px;">Reset your password</h2>
          <p>Hello ${toName || 'there'},</p>
          <p>We received a request to reset your KEREA HRMS password.</p>
          <p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 20px; background: #166534; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600;">
              Reset password
            </a>
          </p>
          <p>If the button does not work, copy and paste this link into your browser:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(errorText || 'Brevo failed to send the password reset email.');
    error.statusCode = 502;
    throw error;
  }
};

module.exports = {
  sendPasswordResetEmail
};
