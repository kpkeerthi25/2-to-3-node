const express = require('express');
const res = require('express/lib/response');
const {GoogleAuth} = require('google-auth-library');
const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const PushAPI = require( "@pushprotocol/restapi");
const ethers = require( "ethers");
const cors = require('cors');    

//push protocol

const PK = ''; // channel private key
const Pkey = `0x${PK}`;
const signer = new ethers.Wallet(Pkey);

const sendNotification = async(adId,dealId) => {
  try {
    const apiResponse = await PushAPI.payloads.sendNotification({
      signer,
      type: 3, // target
      identityType: 2, // direct payload
      notification: {
        title: `Data Migration has been completed`,
        body: ` Ad-id#${adId} Your google drive data has been migrated to filcoin with dealid: ${dealId} `
      },
      payload: {
        title: `Data Migration has been completed`,
        body: `Ad-id#${adId} Your google drive data has been migrated to filcoin with dealid: ${dealId}. feel free to revoke the google drive access`,
        cta: '',
        img: ''
      },
      recipients: 'eip155:5:0x6c07ACDb6E634268Db91c29D2207d49F9c5773AF', // recipient address
      channel: 'eip155:5:0x41a63D515dF724518993e0883Ab2fBe8400b815a', // your channel address
      env: 'staging'
    });
    
    // apiResponse?.status === 204, if sent successfully!
    console.log('API repsonse: ', apiResponse);
  } catch (err) {
    console.error('Error: ', err);
  }
}

//google oauth2

const SCOPES = ['https://www.googleapis.com/auth/drive'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'secret.json');

const auth = new GoogleAuth({
  keyFile:'./secret.json'
});

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {OAuth2Client} authClient An authorized OAuth2 client.
 */
async function listFiles(authClient) {
  const drive = google.drive({version: 'v3', auth: authClient});
  const res = await drive.files.list({
    pageSize: 10,
    fields: 'nextPageToken, files(id, name)',
  });
  const files = res.data.files;
  if (files.length === 0) {
    console.log('No files found.');
    return;
  }

  console.log('Files:');
  files.map((file) => {
    authorize().then(downloadFile(authClient,file.id,file.name)).catch(console.error);
  });
}

async function downloadFile(authClient,fileId,fileName) {
  const drive = google.drive({version: 'v3', auth: authClient});
  const file = await drive.files.get({
    fileId: fileId,
    alt:'media'
  })
  fs.writeFile(fileName,file.data);
  console.log(file.status)

}


const app = express()
app.use(cors());
const port = 3001


app.get('/', (req, res) => {
  res.send('Hello World!')
})
const service = google.drive({version: 'v3', auth: auth});

app.get('/auth', async(req, res) => {
  
  authorize().then(listFiles).catch(console.error);
  // authorize().then(downloadFile).catch(console.error);
  sendNotification(req.query.adId,req.query.dealId);
  res.send("complete");
    
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})