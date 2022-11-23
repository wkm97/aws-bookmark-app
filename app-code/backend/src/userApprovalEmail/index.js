console.log('Loading function');
const AWS = require('aws-sdk');
exports.lambda_handler = (event, context, callback) => {
  console.log('event= ' + JSON.stringify(event));
  console.log('context= ' + JSON.stringify(context));

  const executionContext = event.ExecutionContext;
  console.log('executionContext= ' + executionContext);

  const executionName = executionContext.Execution.Name;
  console.log('executionName= ' + executionName);

  const statemachineName = executionContext.StateMachine.Name;
  console.log('statemachineName= ' + statemachineName);

  const taskToken = executionContext.Task.Token;
  console.log('taskToken= ' + taskToken);

  const apigwEndpint = event.APIGatewayEndpoint;
  console.log('apigwEndpint = ' + apigwEndpint)

  const approveEndpoint = apigwEndpint + "/execution?action=approve&ex=" + executionName + "&sm=" + statemachineName + "&taskToken=" + encodeURIComponent(taskToken);
  console.log('approveEndpoint= ' + approveEndpoint);

  const rejectEndpoint = apigwEndpint + "/execution?action=reject&ex=" + executionName + "&sm=" + statemachineName + "&taskToken=" + encodeURIComponent(taskToken);
  console.log('rejectEndpoint= ' + rejectEndpoint);

  const emailSnsTopic = process.env.emailSnsTopic;
  console.log('emailSnsTopic= ' + emailSnsTopic);

  var emailMessage = 'Welcome! \n\n';
  emailMessage += 'This is an email requiring an approval for a step functions execution. \n\n'
  emailMessage += 'Please check the following information and click "Approve" link if you want to approve. \n\n'
  emailMessage += 'Execution Name -> ' + executionName + '\n\n'
  emailMessage += 'Approval Link: ' +'\n\n'
  emailMessage += '<alink>' + approveEndpoint + '</alink>' + '\n\n'
  emailMessage += 'Reject Link: ' +'\n\n'
  emailMessage += '<rlink>' + rejectEndpoint + '</rlink>' + '\n\n'

  const sns = new AWS.SNS();
  var params = {
    Message: emailMessage,
    Subject: "Required approval from AWS Step Functions",
    TopicArn: emailSnsTopic
  };

  sns.publish(params)
    .promise()
    .then(function(data) {
      console.log("MessageID is " + data.MessageId);
      callback(null);
    }).catch(
      function(err) {
      console.error(err, err.stack);
      callback(err);
    });
}
