
const aws = require('aws-sdk');
const argv = require('minimist')(process.argv.slice(2));

const http = require('http');
const AWS = require('aws-sdk');
const httpProxy = require('http-proxy');
const request = require('request-promise-native');

const accessKeyId = (argv.key || argv.k) || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = (argv.secret || argv.s) || process.env.AWS_SECRET_ACCESS_KEY;
const regHost = (argv.region || argv.r) || process.env.AWS_REGISTRY_HOST;
const region = (argv.reghost || argv.e) || process.env.AWS_REGION;
const port = Number((argv.port || argv.p) || process.env.PORT) || 5000;
const host = ((argv.host || argv.h) || process.env.HOST) || '127.0.0.1';
const refreshEvery = Number(((argv.frequency || argv.q) || process.env.FREQUENCY)) || (1000 * 60 * 5);

let dockerAuth = 2;

async function refreshAuth() {
    const tokenRes = await ecr.getAuthorizationToken({}).promise();
    if (tokenRes && tokenRes.authorizationData.length && tokenRes.authorizationData[0].authorizationToken) {
        dockerAuth = tokenRes.authorizationData[0].authorizationToken;
        console.log('auth refreshed')
    }
}

AWS.config.update({
    credentials: new AWS.Credentials(accessKeyId, secretAccessKey)
});

const ecr = new AWS.ECR({
    region
});

const proxy = httpProxy.createProxyServer({});

async function checkAuth(fullUrl, auth) {
    if (!auth)
        return false;
    
    const url = require('url').parse(fullUrl);
    const resp = await request({
        url: fullUrl,
        headers: {
            Host: url.hostname,
            Authorization: `Basic ${auth}`
        },
        method: 'HEAD',
        resolveWithFullResponse: true,
        simple: false,
        transform: null,
        transform2xxOnly: false,
        followAllRedirects: true,
        followRedirect: true
    });

    return resp.statusCode !== 401 && resp.statusCode !== 403; 
}

async function onReq(proxyReq, req, res, options) {
    proxyReq.setHeader(`Host`, regHost);
    proxyReq.setHeader('Authorization', `Basic ${dockerAuth}`);
}

async function onRes(proxyRes, req, res, options) {
    if (proxyRes.headers.location) {
        const dest = proxyRes.headers.location.toString();
        const rewrite = dest.replace(new RegExp(regHost, 'g'), `${host}:${port}`);
        proxyRes.headers.location = rewrite;
    }
}

proxy.on('proxyReq', onReq);
proxy.on('proxyRes', onRes);

const proxyServer = new (http.Server)((req, res) => {
    proxy.web(req, res, {
        target: `https://${regHost}`
    });
});

refreshAuth().then(() => proxyServer.listen(port, host, (e) => { if(e) { console.error(e.message); process.exit(1); } else { console.log(`listening on ${port}`) } }));

setInterval(refreshAuth, refreshEvery);