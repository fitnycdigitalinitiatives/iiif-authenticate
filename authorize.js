const isObject = require('lodash.isobject');
const isString = require('lodash.isstring');
const jwt = require('jsonwebtoken');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const env_vars = require('./env-config.json');
const apiTokenSecret = env_vars.api_token_secret;
const region = env_vars.region;
const table = env_vars.table;
const client = new DynamoDBClient({ region: region });
const docClient = DynamoDBDocumentClient.from(client);

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
      return false;
  }
}

async function getItemVisibility(id) {
  try {
    const command = new GetCommand({
      TableName: table,
      Key: {
        'key': id,
      },
    });

    const result = await docClient.send(command);
    if (!isObject(result)) {
      return null;
    }
    if (result.Item) {
      if (result.Item.visibility) {
        return result.Item.visibility.toLowerCase();
      } else {
        return null;
      }
    } else {
      return null;
    }
  } catch (error) {
    console.log(error);
    return null;
  }
}

module.exports = authorize;