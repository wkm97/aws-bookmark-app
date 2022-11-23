const AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB()

exports.handler = async message => {
  console.log(message);
  if (message.queryStringParameters != null)
  {
    let theuser = message.queryStringParameters.user
    console.log(`The user is: ${theuser}`)

    let params = {
      TableName: process.env.TABLE_NAME,
      IndexName: process.env.INDEX_NAME,
      KeyConditionExpression: "username = :keyname",
      ExpressionAttributeValues: {
        ":keyname": {"S": theuser}
      }
    };
  
    console.log(`Getting all bookmarks from table ${process.env.TABLE_NAME}`);
    let results = await dynamodb.query(params).promise()
    console.log(`Done: ${JSON.stringify(results)}`);
  
    return {
      statusCode: 200,
      headers: {"Access-Control-Allow-Origin": '*'},
      body: JSON.stringify(results.Items)
    };
  }
}
