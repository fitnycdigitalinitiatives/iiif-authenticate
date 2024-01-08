const authorize = require('./authorize');
const isString = require('lodash.isstring');

// Integer RegEx
const IR = '\\d+';
// Float RegEx
const FR = '\\d+(?:\.\\d+)?'; // eslint-disable-line no-useless-escape

const Validators = {
  quality: ['color', 'gray', 'bitonal', 'default'],
  format: ['jpg', 'jpeg', 'tif', 'tiff', 'png', 'webp'],
  region: ['full', 'square', `pct:${FR},${FR},${FR},${FR}`, `${IR},${IR},${IR},${IR}`],
  size: ['full', 'max', `pct:${FR}`, `${IR},`, `,${IR}`, `\\!?${IR},${IR}`],
  rotation: `\\!?${FR}`
};

function iiifRegExp() {
  const transformation = ['region', 'size', 'rotation'].map(type => validator(type)).join('/') +
    '/' + validator('quality') + '.' + validator('format');

  return new RegExp(`^/?(?<id>.+?)/(?:(?<info>info.json)|${transformation})$`);
}

function validator(type) {
  let result = Validators[type];
  if (result instanceof Array) {
    result = result.join('|');
  }
  return `(?<${type}>${result})`;
}

function getEventHeader(request, name) {
  if (request.headers && request.headers[name] && request.headers[name].length > 0) {
    return request.headers[name][0].value;
  } else {
    return undefined;
  }
}

function getBearerToken(request) {
  let authHeader = getEventHeader(request, 'authorization');
  if (isString(authHeader)) {
    return authHeader.replace(/^Bearer /, '');
  }
  return null;
}

function addAccessControlHeaders(request, response) {
  response.headers['access-control-allow-origin'] = [{
    key: 'Access-Control-Allow-Origin',
    value: '*'
  }];
  response.headers['access-control-allow-headers'] = [{
    key: 'Access-Control-Allow-Headers',
    value: 'authorization'
  }];
  response.headers['access-control-allow-credentials'] = [{
    key: 'Access-Control-Allow-Credentials',
    value: 'true'
  }];
  return response;
}

function viewerRequestOptions(request) {
  const response = {
    status: '200',
    statusDescription: 'OK',
    headers: {},
    body: 'OK'
  };

  return addAccessControlHeaders(request, response);
}

async function viewerRequestIiif(request) {
  // Check if this is a request for resource itself rather something else that wouldn't need to be authorized (ie endpoint or something that would be redirected)
  const path = decodeURI(request.uri);
  const segments = path.split('/');
  if ((path.startsWith('/iiif/2/') || path.startsWith('/iiif/3/')) && (segments.length > 4)) {
    const path_suffix = path.substring(8);
    const iiif_reg_exp = iiifRegExp().exec(path_suffix);
    if (iiif_reg_exp && iiif_reg_exp.groups.id) {
      const id = decodeURIComponent(iiif_reg_exp.groups.id + '.tif');
      const authToken = getBearerToken(request);
      const authed = await authorize(authToken, id);
      console.log('Authorized:', authed);

      // Return a 403 response if not authorized to view the requested item
      if (!authed) {
        const response = {
          status: '403',
          statusDescription: 'Forbidden',
          body: 'Forbidden'
        };
        return response;
      }

      return request;
    } else {
      return request;
    }
  } else {
    return request;
  }
}

async function processViewerRequest(event) {
  console.log('Initiating viewer-request trigger')
  const {
    request
  } = event.Records[0].cf;
  let result;

  if (request.method === 'OPTIONS') {
    // Intercept OPTIONS request and return proper response
    result = viewerRequestOptions(request);
  } else {
    result = await viewerRequestIiif(request);
  }

  return result;
}

async function processViewerResponse(event) {
  console.log('Initiating viewer-response trigger')
  const {
    request,
    response
  } = event.Records[0].cf;
  return addAccessControlHeaders(request, response);
}

async function processRequest(event, _context, callback) {
  const {
    eventType
  } = event.Records[0].cf.config;
  let result;

  console.log('Event Type:', eventType);
  if (eventType === 'viewer-request') {
    result = await processViewerRequest(event);
  } else if (eventType === 'viewer-response') {
    result = await processViewerResponse(event);
  } else {
    result = event.Records[0].cf.request;
  }

  return callback(null, result);
}

module.exports = {
  handler: processRequest
};