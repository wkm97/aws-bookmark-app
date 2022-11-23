const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();


exports.handler = async message => {
   console.log(message);
   let bookmark = message;
   const emailSnsTopic = process.env.emailSnsTopic;
   const bookmarkDetails = JSON.stringify(bookmark);
   console.log("bookmarkDetails are "+bookmarkDetails);
   const bookmarkItem = JSON.parse(bookmarkDetails);
   console.log(bookmarkItem.detail.payload.id.S);
   if(message != null) 
    {
      var updateParams = {
      TableName: process.env.TABLE_NAME,
      Key:{
          "id": bookmarkItem.detail.payload.id.S
      },
      UpdateExpression: "set publish = :p",
      ExpressionAttributeValues:{
          ":p": "Approved"
      },
      ReturnValues:"UPDATED_NEW"
    };
    await docClient.update(updateParams, function(err, data) {
      if (err) {
        console.log("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
      }
      else {
        console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
      }
    }).promise();
   }
  const sns = new AWS.SNS();
  var params = {
    Message: "Publishing approved ",
    Subject: "Publishing email approval from AWS Step Functions",
    TopicArn: emailSnsTopic
  };

  sns.publish(params)
    .promise()
    .then(function(data) {
      console.log("MessageID is " + data.MessageId);

    }).catch(
      function(err) {
      console.error(err, err.stack);
    });
    
    return {};
};
