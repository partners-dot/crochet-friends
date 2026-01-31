/* Send Video Email - Uses Resend to email video link to user */
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { email, videoUrl, product, userType } = req.body;
        
        if (!email || !videoUrl) {
            return res.status(400).json({ error: 'Email and videoUrl required' });
        }

        const BASE_URL = 'https://crochet-friends1.vercel.app';
        const videoPageUrl = `${BASE_URL}/video.html?v=${encodeURIComponent(videoUrl)}`;
        
        // Character images for email
        const characterImages = {
            potato: `${BASE_URL}/images/potato.jpg`,
            cupcake: `${BASE_URL}/images/cupcake.jpg`,
            yoda: `${BASE_URL}/images/yoda.jpg`
        };
        const characterImage = characterImages[product] || characterImages.potato;

        // Amazon review link
        const amazonReviewUrl = 'https://www.amazon.com/review/create-review?asin=B0DK1RF3TZ';

        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a2e;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a2e; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" max-width="500" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a4e 0%, #0d0d35 100%); border-radius: 24px; overflow: hidden; max-width: 500px;">
                    
                    <!-- Header -->
                    <tr>
                        <td align="center" style="padding: 40px 30px 20px;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                                🎉 Your Video is Ready!
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Character Image -->
                    <tr>
                        <td align="center" style="padding: 20px 30px;">
                            <img src="${characterImage}" alt="Your Crochet Friend" style="width: 150px; height: 150px; border-radius: 20px; object-fit: cover; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                        </td>
                    </tr>
                    
                    <!-- Message -->
                    <tr>
                        <td align="center" style="padding: 10px 30px 30px;">
                            <p style="margin: 0; color: #e0e0e0; font-size: 18px; line-height: 1.6;">
                                Your personalized video message is ready!<br>
                                <strong style="color: #ffd166;">Share it with someone special 💝</strong>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- CTA Button -->
                    <tr>
                        <td align="center" style="padding: 0 30px 30px;">
                            <a href="${videoPageUrl}" style="display: inline-block; background: linear-gradient(135deg, #ffd166 0%, #f4a942 100%); color: #1a1a4e; text-decoration: none; padding: 18px 40px; border-radius: 50px; font-size: 18px; font-weight: 700; box-shadow: 0 8px 25px rgba(255, 209, 102, 0.4);">
                                👀 Watch & Share Your Video
                            </a>
                        </td>
                    </tr>
                    
                    <!-- Divider -->
                    <tr>
                        <td style="padding: 0 30px;">
                            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 0;">
                        </td>
                    </tr>
                    
                    <!-- Review Section -->
                    <tr>
                        <td align="center" style="padding: 30px;">
                            <p style="margin: 0 0 15px; color: #a0a0a0; font-size: 14px;">
                                ⭐ Love your experience? Help us grow!
                            </p>
                            <a href="${amazonReviewUrl}" style="color: #ffd166; text-decoration: none; font-size: 14px; font-weight: 600;">
                                Leave a Review on Amazon →
                            </a>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 30px 30px; border-top: 1px solid rgba(255,255,255,0.05);">
                            <p style="margin: 0; color: #666; font-size: 12px;">
                                © Got You A Little Something<br>
                                Made with 💛 for gift-givers everywhere
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        const { data, error } = await resend.emails.send({
            from: 'Got You A Little Something <noreply@resend.dev>',
            to: email,
            subject: '🎉 Your Video is Ready to Share!',
            html: emailHtml
        });

        if (error) {
            console.error('Resend error:', error);
            return res.status(500).json({ error: 'Failed to send email', details: error });
        }

        console.log('Email sent successfully:', data);
        return res.status(200).json({ success: true, messageId: data.id });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Server error', details: error.message });
    }
}
