/* See license.txt for terms of usage */

// This line is to enable debuging massaging and module structure in workers
importScripts("chrome://firestorm/content/detection/detectionModule.js");

// ********************************************************************************************* //
// 

var specialCharDetecModule = Obj.extend(DetectionModule,
{
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Module MetaData
    // 
    
    name: "Difference analyser",
    description: "Analyses replies from a function by checking the difference between the input \
    and the output for a one argument filter.",                                                                             

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Module Methods


    /**
     * Function called in order to detect anomalies in the given dectection data matrix.
     * This matrix is formed as:
     *  [
     *      {
     *         uuid: <id>,
     *          args: <argumentsUsed>,
     *          response: {
     *              HTML: <pageHTML>,
     *              context: <serializedViewOfWindowObject>,
     *              callStack: <SerializedCallStack>,
     *              value: <functionReturnedValue>,
     *              error: <error>                                                                      // is false if there were no error during the 
     *          }                                                                                       // the fuzzing execution, else it contains the error
     *      }                                                                                           //  message
     *  ]
     * @param  {Array} detectionData Matrix of environement data after the function execution
     * @return {Array}               An array of detection results. This should have to following
     *                               shape so that the framework can map correctly the executions to
     *                               the results
     *
     * [
     *     {
     *         uuid: <elementId>                                                                          // same as above
     *         args: <argumentsUsed>
     *         response: {
     *              HTML: <pageHTML>,
     *              context: <serializedViewOfWindowObject>,
     *              callStack: <SerializedCallStack>,
     *              value: <functionReturnedValue>,
     *              error: <error>
     *         },
     *         detection: {                                                                             // generated by the function
     *             result: <boolean>,                                                                   // true if something is wrong, false otherwise
     *             options: <JSONObjectThatwillBePassedToTheTemplateForYourUse>
     *         }
     *     }
     * ]
     */
    detect: function(detectionData){
        return detectionData.map(function(element, index, array){
            return {
               "uuid": element.uuid,                                                                 
               "args": element.args,
               "response": {
                    "HTML": element.response.HTML,
                    "context": element.response.context,
                    "callStack": element.response.callStack,
                    "value": element.response.value,
                    "error": element.response.error
               },
               "detection": {                                                                 
                   "result": element.args ? element.args[0] === element.response.value : false          // Here we consider that is the result of the function
                                                                                                        // is the same as the first argument, then there is a
               }                                                                                        // problem. Moreover if argument is not defined, it 
           }                                                                                            // is because it is reference data (without function)
        });                                                                                             // execution, we just ignore it.
    },

    /**
     * Generates a message info for a function unique execution.
     * 
     * @param  {Object} ElementDetectionInfo Informations on a function execution and detections results:
     *
     *    {
     *         uuid: <elementId>                                                                          // same as above
     *         args: <argumentsUsed>
     *         response: {
     *              HTML: <pageHTML>,
     *              context: <serializedViewOfWindowObject>,
     *              callStack: <SerializedCallStack>,
     *              value: <functionReturnedValue>,
     *              error: <error>,
     *         },
     *         detection: {                                                                             // generated by the function
     *             result: <boolean>,
     *         }
     *     }
     * 
     * @return {String}              String that will be inserted as a text just beneath the test
     *                               results.
     */
    info: function(Element){
        if (Element.detection.result)
            return "The filter didn't filter the entry";
        else
            return "The filter perfomed ok";
    }


});

// ********************************************************************************************* //
// Registration

onmessage = function(e){
    specialCharDetecModule.onMessage(e,specialCharDetecModule);
};