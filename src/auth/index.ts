import { google } from "googleapis"
import fs from "fs";
import crypto from "crypto";

const keyfile = './google-credentials.json';

const content = fs.readFileSync(keyfile)
const keys = JSON.parse(content.toString());

const scopes = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'];

// Create an oAuth2 client to authorize the API call
const client = new google.auth.OAuth2(
    keys.web.client_id,
    keys.web.client_secret,
    keys.web.redirect_uris[0],
);

google.options({ auth: client });

export function generateAuthUrl() {
    const correlationId = crypto.randomBytes(32).toString('hex');
    const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        include_granted_scopes: true,
        response_type: '',
        prompt: 'consent',
    });
    return { authUrl, correlationId };
}

export async function authUrlCallbackMiddleware(req, res, next) {
    try {
        const qs = req.query
        const { tokens } = await client.getToken(qs['code'] as string);
        req.auth = tokens;
        next()
    } catch (e) {
        console.error(e)
        res.end('Authentication failed! Please return to the console.');
    }
}

export function createOAuthClient(refreshToken: string) {
    const client = new google.auth.OAuth2(
        keys.web.client_id,
        keys.web.client_secret,
        keys.web.redirect_uris[0],
    );
    client.setCredentials({ refresh_token: refreshToken });
    return client;
}