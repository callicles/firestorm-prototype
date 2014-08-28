/* See license.txt for terms of usage */

// This line is to enable debuging massaging and module structure in workers
importScripts("chrome://firestorm/content/core/moduleWorker.js");

// ********************************************************************************************* //
// Brain Module
// 
// This script represents the super class of every brain module. It declares the interface 
// of the method that can be called by the fuzzing dispatcher.
// 
// A brain module is a module that handles any adaptation aspect of a fuzzing session. It represents
// the smart part of a fuzzer. It is it "brain" :-)

var BrainModule  = 
{


    /**
     * Array of all the workers. Each element of the list should be formated as :
     * {
     *     id: i,
     *     worker: <>
     * }
     * 
     * @type {Array}
     */
    genWorkers: [],

    /**
     * This represents the data already produced by the generators for the current session.
     * It is represented as following:
     *
     *  [
     *      {
     *          id: i,
     *          batch:  [<dataBatch for argument i>]
     *      },
     *                  .
     *                  .
     *                  .
     *  ]
     * 
     * @type {Array}
     */
    currentBatch: [],

    /**
     * Message handler for a generation Module Worker. It receives the message, checks if it is a
     * genereation requests, calls the right generation method, and sends the response to the brain
     * worker Module.
     * 
     * @param  {Event} event event thrown when a message is received by the worker
     * @return {void}
     */
    onMessage: function (event, extended){

        if (event.data.command === "handleGeneration"){

            this.generatedBatches = [];
            var request = event.data.payload;

            this.handleGeneration(request.batchSize, request.previousBatch);
        } else if (event.data.command === "initializeBrain"){
            this.initialize(event.data.payload);
        } else if (event.data.command === "checkIntegrity"){
            debugMessage("fireStorm; BrainModule.checkIntegrity Message");     
            message.debug = false;
            message.class = "integrityCheck";
            message.payload = {
                fileName: event.data.payld,
                check: extended.checkIntegrity(),
                caract: {
                    name: this.name,
                    description: this.description
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
        check.genModulesCompatible = this.genModulesCompatible.length != 0;    

        return check;
    },

    /**
     * Creates all the workers needed to generate fuzzing data
     * 
     * @param  {Object} genModules the object contains a map of all the generator module files to load
     * @return {void}            
     */
    initialize: function(genModules){

        var self = this;
        var j = 0;

        for (var i in genModules){

            this.genWorkers.push({id: i, worker: new Worker(genModules[i])});

            this.genWorkers[j].worker.onmessage = function(event){
                self.onGeneratorMessage.call(self,event.data);
            };
            j++;
        }

        message.debug = false;
        message.class = "intializationMark";
        message.payload = genModules;
        postMessage(message);
    },

    /**
     * Event handler to catch the generation worker response. It adds the reponse to the response list,
     * then checks if all the generators have completed their task. If they have, it calls the method
     * sendBatchToBeFuzzed.
     * 
     * @param  {Object} message message received from a module generator
     * @return {void} 
     */
    onGeneratorMessage: function(message){
        if (!message.debug && message.class === "genModResponse"){
            this.currentBatch.push(
                {
                    id: message.payload.id,
                    batch: message.payload.batch
                }
            );
        } else if (message.debug){                                                                      // If it is a debug message of the subWorker, we 
            postMessage(message);                                                                       // Send it to the parent thread to be displayed.
        }

        if (this.currentBatch.length == this.genWorkers.length){
            message.debug = false;
            message.class = "brainModResponse";
            message.payload = this.sendBatchToBeFuzzed(this.currentBatch);
            postMessage(message);
            this.clearCurrentGen();                                                                     // We sent a response so we clear the generation workers,
        }                                                                                               // they are without state and we don't need them anymore
    },

    /**
     * Method to terminate all the different opened thread and liberate the memory, also clears the
     * current batch array.
     * 
     * @return {void}
     */
    clearCurrentGen: function(){
        while(this.genWorkers.length != 0){
            this.genWorkers.pop().worker.terminate();
            this.currentBatch.pop();
        }
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Module MetaData and methods to be overriden
    // 
    
    name: null,
    description: null,

    /**
     * This array represents the list of generators that are compatible with this brain module.
     * If the first element is a '*', it will consider all generators as compatible
     * @type {Array}
     */
    genModulesCompatible: [],                                                                             

    handleGeneration: function(batchSize, previousBatch){

    },

    /**
     * This method is called when all the generators have sent they respective generated batches.
     * It is responsible for returning all the arguments batches that will be used for the fuzzing.
     * as the following format.
     *
     *  [
     *      [arg1, arg2, arg3, ... ],                 --> arguments to use for the first execution
     *      [arg1, arg2, arg3, ... ],                 --> arguments to use for the second execution
     *                  .
     *                  .
     *                  .
     *  ]
     * 
     * @param  {Array} generatedBatches this corresponds to BrainModule.currentBatch
     * @return {Array}                  Array of argument lists to feed to the fuzzed function
     */
    sendBatchToBeFuzzed: function(generatedBatches){

    }

};
