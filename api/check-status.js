/* Check Video Generation Status - Polls Veo API for operation status */
import { GoogleAuth } from 'google-auth-library';
  
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { operationId } = req.query;
        if (!operationId) return res.status(400).json({ error: 'operationId required' });

        // Parse Google Credentials from env var
        const googleCredentials = JSON.parse(process.env.GOOGLE_CONFIG_JSON);
        const PROJECT_ID = googleCredentials.project_id;
        const LOCATION = 'us-central1';
        const MODEL_ID = 'veo-3.1-fast-generate-preview';

        // Authenticate and get Access Token
        const auth = new GoogleAuth({
            credentials: googleCredentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        const token = accessToken.token;

        // Poll the operation status
        const fetchOperationUrl = 'https://' + LOCATION + '-aiplatform.googleapis.com/v1/projects/' + PROJECT_ID + '/locations/' + LOCATION + '/publishers/google/models/' + MODEL_ID + ':fetchPredictOperation';

        const pollResponse = await fetch(fetchOperationUrl, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ operationName: operationId })
        });

        if (!pollResponse.ok) {
            const errorText = await pollResponse.text();
            console.error('Polling error:', errorText);
            throw new Error('Poll API Error: ' + pollResponse.status + ' - ' + errorText);
        }

        const pollData = await pollResponse.json();

        // Log the full response for debugging
        console.log('Poll response for operation:', operationId);
        console.log('Poll data:', JSON.stringify(pollData, null, 2));

        // Check for error state before done check
        if (pollData.error && !pollData.done) {
            console.error('Poll returned error:', JSON.stringify(pollData.error, null, 2));
            return res.status(200).json({
                status: 'error',
                error: pollData.error.message || pollData.error.code || 'Generation failed',
                details: pollData.error
            });
        }

        // Check for failed/cancelled state in metadata
        if (pollData.metadata) {
            const state = pollData.metadata.state;
            if (state === 'FAILED' || state === 'CANCELLED' || state === 'BLOCKED') {
                console.error('Generation state:', state, JSON.stringify(pollData.metadata, null, 2));
                return res.status(200).json({
                    status: 'error',
                    error: pollData.metadata.failureReason || 'Video generation ' + state.toLowerCase()
                });
            }
        }

        if (pollData.done) {
            if (pollData.error) {
                console.error('Generation completed with error:', JSON.stringify(pollData.error, null, 2));
                return res.status(200).json({
                    status: 'error',
                    error: pollData.error.message || pollData.error.code || 'Generation failed',
                    details: pollData.error
                });
            }

            // Success - extract video URL
            const result = pollData.response;
            if (result && result.videos && result.videos.length > 0) {
                const videoUri = result.videos[0].gcsUri || result.videos[0].uri;

                // If it's base64 encoded video data
                if (result.videos[0].bytesBase64Encoded) {
                    const videoData = result.videos[0].bytesBase64Encoded;
                    const dataUri = 'data:video/mp4;base64,' + videoData;
                    console.log('Video generation successful (base64)');
                    return res.status(200).json({
                        status: 'done',
                        videoUrl: dataUri
                    });
                }

                console.log('Video generation successful, URL:', videoUri);
                return res.status(200).json({
                    status: 'done',
                    videoUrl: videoUri
                });
            } else {
                console.error('No video in response:', JSON.stringify(result, null, 2));
                return res.status(200).json({
                    status: 'error',
                    error: 'No video in response'
                });
            }
        }

        // Still processing
        console.log('Still processing...');
        return res.status(200).json({ status: 'pending' });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Server error', details: error.message });
    }
            }
