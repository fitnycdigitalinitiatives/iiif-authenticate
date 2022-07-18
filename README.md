## Description

Lambda@edge function to authenticate iiif requests. Based on [functions](https://github.com/nulib/iiif-server-terraform) by Northwestern University Library.

## Variables

* `api_token_secret` - The secret used to encrypt/decrypt JavaScript Web Tokens
* `region` - Region of the DynamoDB that contains visibility information for resources
* `table` - Table name of the DynamoDB that contains visibility information for resources
