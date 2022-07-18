const isObject = require('lodash.isobject');
const isString = require('lodash.isstring');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
const env_vars = require('./env-config.json');

const apiTokenSecret = env_vars.api_token_secret;
const region = env_vars.region;
const table = env_vars.table;

function allowedFromRegexes(str) {
  var configValues = isString(str) ? str.split(';') : [];
  var result = [];
  for (var re in configValues) {
    result.push(new RegExp(configValues[re]));
  }
  return result;
}

function getCurrentUser(token) {
  if (isString(token)) {
    try {
      return jwt.verify(token, apiTokenSecret);
    } catch (err) {
      return null;
    }
  } else {
    return null;
  }
}

async function authorize(token, id) {
  const currentUser = getCurrentUser(token);
  if (isObject(currentUser)) {
    if (currentUser.visibility == 'public') {
      console.log('Item ID:', id);
      console.log('Visibility: public');
      return true;
    } else if (currentUser.user != 'Anonymous') {
      console.log('Item ID:', id);
      console.log('User:', currentUser.user);
      return true;
    }
  }
  const username = 'Anonymous';
  const visibility = await getItemVisibility(id);

  console.log('User:', username);
  console.log('Item ID:', id);
  console.log('Visibility:', visibility);

  switch (visibility) {
    case 'public':
      return true;
    case 'private':
      return false;
    default:
      return true;
  }
}

async function getItemVisibility(id) {
  // Set the region
  AWS.config.update({
    region: region
  });
  const docClient = new AWS.DynamoDB.DocumentClient({
    apiVersion: '2012-08-10'
  });
  try {
    var params = {
      TableName: table,
      Key: {
        'key': id
      }
    };
    var result = await docClient.get(params).promise();
    if (!isObject(result)) {
      return null;
    }
    if (result.Item.visibility) {
      return result.Item.visibility.toLowerCase();
    } else {
      return null;
    }
  } catch (error) {
    console.log(error);
    return null;
  }
}

module.exports = authorize;