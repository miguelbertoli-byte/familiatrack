// Netlify Function: send-push.js
// Envía notificaciones push a todos los miembros de la sala via FCM

const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const { tokens, title, body, data } = JSON.parse(event.body);

    if (!tokens || tokens.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ sent: 0 }) };
    }

    // Get access token using service account
    const accessToken = await getAccessToken();

    // Send to each token
    const results = await Promise.allSettled(
      tokens.map(token => sendToToken(token, title, body, data, accessToken))
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sent, total: tokens.length })
    };

  } catch (err) {
    console.error('send-push error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};

async function getAccessToken() {
  const serviceAccount = {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    project_id: 'te-ubico-9080b'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  };

  const jwt = await createJWT(payload, serviceAccount.private_key);

  return new Promise((resolve, reject) => {
    const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.access_token) resolve(parsed.access_token);
        else reject(new Error('No access token: ' + data));
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function sendToToken(token, title, body, data, accessToken) {
  const message = {
    message: {
      token,
      notification: { title, body },
      data: data || {},
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'familiatrack' }
      },
      webpush: {
        headers: { Urgency: 'high' },
        notification: { title, body, icon: '/icon.png', badge: '/icon.png', vibrate: [300, 100, 300] },
        fcmOptions: { link: 'https://dulcet-phoenix-67ae3a.netlify.app' }
      }
    }
  };

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(message);
    const req = https.request({
      hostname: 'fcm.googleapis.com',
      path: `/v1/projects/te-ubico-9080b/messages:send`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(data);
        else reject(new Error(`FCM error ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function createJWT(payload, privateKey) {
  const crypto = require('crypto');
  const header = { alg: 'RS256', typ: 'JWT' };
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(privateKey, 'base64url');
  return `${signingInput}.${signature}`;
}
