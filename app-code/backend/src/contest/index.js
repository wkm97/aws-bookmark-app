const AWS = require('aws-sdk');

const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2));
    const Key = { id: event.detail.id };
    
    var params = {
      TableName: process.env.TABLE_NAME,
      Key:{
          "id": event.detail.id
      },
      UpdateExpression: "set contest = :p",
      ExpressionAttributeValues:{
          ":p":"Entered"
      },
      ReturnValues:"UPDATED_NEW"
    };
    
    console.log("Updating the item...", params);
    let response = await docClient.update(params, function(err, data) {
        if (err) {
            console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
        }
    }).promise();
    
    console.log("Response:", response);
}