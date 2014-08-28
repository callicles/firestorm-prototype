/* See license.txt for terms of usage */

importScripts(
    "chrome://firestorm/content/core/moduleWorker.js"
    );

// ********************************************************************************************* //
// Generation Module
// 
// This script represents the super class of every generation module. It declares the interface 
// of the method that can be called by a brain module.
// 
// A generation module is a module that generates batches (Array) of data. This data will be fed
// to a function as the content of one of its arguments.
var GenerationModule =
{
    /**
     * Message handler for a generation Module Worker. It receives the message, checks if it is a
     * genereation requests, calls the right generation method, and sends the response to the brain
     * worker Module.
     * 
     * @param  {Event} event event thrown when a message is received by the worker
     * @return {void}
     */
    onMessage: function (event, extended){

        if (event.data.command === "generate"){
            var args = event.data.payld.args;

            var message = {};
            message.debug = false;
            message.class = "genModResponse"
            message.payload = {
                id: event.data.payld.id,
                batch:(args.length > 0) ? this.generateFromParameters(event.data.batchSize,
                    event.data.payld.args) : this.generate(event.data.payld.batchSize)
            }

            postMessage(message);
        } else if (event.data.command === "checkIntegrity"){
            debugMessage("fireStorm; GenerationModule.checkIntegrity Message");
            
            var message = {};     
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
        check.generate = this.generate(10).length === 10;    

        return check;
    },


    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Module MetaData and methods to be overriden
    // 
    
    name: null,
    description: null,

    /**
     * This Array represents all the brain module that can handle this generator by using its
     * 'generateFromParameter' method. By default, when the list is empty, only the noBrainer brain
     * module is compatible. The noBrainer module is just a completetly stupid module that will
     * call the generate Method with a large batch size.
     * 
     * @type {Array}
     */
    brainModulesCompatible: [],                                                                             

    /**
     * Method called when a "generate message" arrives to the worker module to generate some data from
     * the sent arguments. 
     *
     * It must handles any arguments throwns by the declared compatible brain modules.
     *
     * If no brain module is declared compatible, this doesn't have to be implemented
     *
     * @param  {Integer}    batchSize   Size of the requested data batch
     * @param  {Array}      args        Array of arguments sent by the brain
     * @return {Array}                  Array corresponding to a batch of generated data
     */
    generateFromParameters: function(batchSize, args){
        return [];
    },

    /**
     * Method called when a "generate message" arrives to the worker module to generate some data
     *
     * This method ALWAYS should be implemented
     * 
     * @param  {Integer}    batchSize   Size of the requested data batch
     * @return {Array}      Array corresponding to a batch of generated data
     */
    generate: function(batchSize){
        return [];
    }

};
