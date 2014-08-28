/* See license.txt for terms of usage */

// This line is to enable debuging massaging and module structure in workers
importScripts("chrome://firestorm/content/core/moduleWorker.js");

// ********************************************************************************************* //
// Detection Module
// 
// This script represents the super class of every detection module. It declares the interface 
// of the method that can be called by the dispatcher at when functions have been executed with some
// parameters.
// 
// A detection module is a module that analyses the function responses and environement evolution
// to detect anomalies.

var DetectionModule  = 
{
    /**
     * Message handler for a detection Module Worker. It receives the message, checks if it is a
     * detection request, calls the right detection method, and sends the response to the dispatcher.
     * 
     * @param  {Event} event event thrown when a message is received by the worker
     * @return {void}
     */
    onMessage: function (event, extended){
        if (event.data.command === "detect"){

            var payloadToSend = this.launchDetection(event.data.payld);

            var message = {
                debug: false,
                class: "detectModResponse",
                payload: payloadToSend
            }            

            postMessage(message);
        } else if (event.data.command === "checkIntegrity"){
            debugMessage("fireStorm; DetectionModule.checkIntegrity Message");

            var message = {
                debug: false,
                class: "integrityCheck",
                payload: {
                    fileName: event.data.payld,
                    check: extended.checkIntegrity(),
                    caract: {
                        name: this.name,
                        description: this.description
                    }
                }
            }       

            postMessage(message);
        }
    },

    /**
     * Function that checks that the module is implemented correctly
     * 
     * @return {Object} Object with the properties names as keys and boolean if they are implemented 
     */
    checkIntegrity: function(){
        var check = {};

        check.name = this.name != null;
        check.description = this.description != null;
        check.detect = this.detect([
            {
                "uuid": "{1}",
                "args": ["a", "b"],
                "response": {
                    "HTML": "<html></htm>",
                    "context": "someJSON",
                    "callStack": [],
                    "value": "winter is comming",
                    "error": false
                }
            },
            {
                "uuid": "{2}",
                "args": undefined,
                "response": {
                    "HTML": "<html>test</htm>",
                    "context": "someJSON",
                    "callStack": [],
                    "value": undefined,
                    "error": false
                }
            },
        ]).length != 0;
        check.template = this.info({detection:{result:false}}).length != undefined;    

        return check;
    },

    /**
     * Method called by the dispatcher to start detection on the data
     * 
     * @param  {Array} detectionData Array containing all the fuzzed data that needs to be interpreted
     *                               by the detection Module
     * @return {Array}               Array containing all the fuzzed data and the results of the
     *                               detection
     */
    launchDetection: function(detectionData){
        var detectionReturn = this.detect(detectionData);
        const self = this;
        var detectionWithInfo =  detectionReturn.map(function(element, index, array){
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
                   "result": element.detection.result,                                 
                   "info": self.info(element)                                                
               }                                                                                       
           }
        });
        return detectionWithInfo;
    },


    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Module MetaData and methods to be overriden
    // 
    
    name: null,
    description: null,

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
     *         }
     *     }
     * ]
     */
    detect: function(detectionData){
        return [];
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
        return ""
    }

};

