
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
const host = ((argv.host || argv.h) || process.env.HOST) || 'localhost';
const refreshEvery = Number(((argv.frequency || argv.q) || process.env.FREQUENCY)) || (1000 * 60 * 5);

let dockerAuth = 2;

async function refreshAuth() {
    console.log('refreshing ecr auth');
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

const proxy = httpProxy.createProxyServer({
    target: `https://${regHost}`,
    secure: false,
    get headers() {
        return { 
            authorization: `Basic ${dockerAuth}`,
            host: regHost
        };
    }
});

function onStart(req, res, target) {
    req.headers['host'] = regHost;
    req.headers['authorization'] = `Basic ${dockerAuth}`;
}

function onRes(proxyRes, req, res) {
    if (proxyRes.headers.location) {
        const dest = String(proxyRes.headers.location);
        const rewrite = dest.replace(new RegExp(`https://${regHost}`), `http://${host}`);

        proxyRes.headers.location = rewrite;
    }
}

proxy.on('start', onStart);
proxy.on('proxyRes', onRes);
proxy.on('error', (err) => {
    console.error(err.message);
})

refreshAuth().then(() => proxy.listen(port, (e) => { if(e) { console.error(e.message); process.exit(1); } else { console.log(`listening on ${port}`) } }));

setInterval(refreshAuth, refreshEvery); 