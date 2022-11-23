const AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB()

exports.handler = async message => {
  console.log(message);
  let bookmarkId = message.pathParameters.id
  let params = {
    TableName: process.env.TABLE_NAME,
    Key: {
      id: { S: bookmarkId }
    }
  };

  console.log(`Deleting bookmark ${bookmarkId} from table ${process.env.TABLE_NAME}`);
  let results = await dynamodb.deleteItem(params).promise()
  console.log(`Done: ${JSON.stringify(results)}`);

  return {
    statusCode: 200,
    headers: {"Access-Control-Allow-Origin": '*'},
    body: JSON.stringify({})
  };
}
